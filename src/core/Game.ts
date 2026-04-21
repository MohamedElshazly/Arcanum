import * as THREE        from 'three'
import { SceneManager }  from './SceneManager'
import { InputManager }  from './InputManager'
import { Player }        from '../entities/Player'
import { Projectile }    from '../entities/Projectile'
import { SpellCaster }   from '../spells/SpellCaster'
import { SpellBar }      from '../spells/SpellBar'
import { HUD }           from '../ui/HUD'
import { DungeonSession } from '../dungeon/DungeonSession'
import { LoadoutScreen } from '../ui/LoadoutScreen'

import { EvolutionOverlay } from '../ui/EvolutionOverlay'
import { RunSummaryScreen } from '../ui/RunSummaryScreen'
import { Spellbook }       from '../ui/Spellbook'
import { PlayerInventory }  from '../progression/PlayerInventory'
import { MasterySystem }    from '../progression/MasterySystem'
import { Grimoire }         from '../progression/Grimoire'
import { RunData }          from '../progression/RunData'
import {
  IEffect,
  castBlink,
  FrozenNovaEffect,
  IceWallEffect,
  ThunderClapEffect,
  ArcaneExplosionEffect,
  StaticFieldEffect,
  FrostDecalEffect,
  LightningBoltEffect,
} from '../spells/SpellEffects'
import { circleVsRect }  from '../utils/CollisionUtils'
import {
  DELTA_CAP,
  ENEMY_HALF_X,
  ENEMY_HALF_Z,
} from '../constants'
import { SPELLS } from '../spells/SpellDefinitions'
import type { Enemy } from '../entities/Enemy'

const SLOT_KEYS = ['KeyQ', 'KeyE', 'KeyR', 'KeyF'] as const

export class Game {
  private sceneManager:  SceneManager
  private inputManager:  InputManager
  private session:       DungeonSession
  private player:        Player
  private spellCaster:   SpellCaster
  private spellBar:      SpellBar
  private hud:           HUD
  private projectiles:   Projectile[]  = []
  private activeEffects: IEffect[]     = []
  private clock          = new THREE.Clock()

  private mouseWorld     = new THREE.Vector3()
  private floorPlane     = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private mouseRaycaster = new THREE.Raycaster()
  private mouseNDC       = new THREE.Vector2()

  // Progression
  private inventory:    PlayerInventory
  private mastery:      MasterySystem
  private grimoire:     Grimoire
  private runData:      RunData

  // UI
  private loadoutScreen:    LoadoutScreen | null = null
  private runSummaryScreen: RunSummaryScreen | null = null
  private evolutionOverlay: EvolutionOverlay

  // Run state
  private running  = false
  private rafId    = 0
  private lastRoomCleared = false

  constructor() {
    this.sceneManager = new SceneManager()
    this.inputManager = new InputManager()
    this.player       = new Player()
    this.session      = new DungeonSession()

    this.inventory = new PlayerInventory()
    this.mastery   = new MasterySystem()
    this.grimoire  = new Grimoire()
    this.runData   = new RunData()

    this.spellBar    = new SpellBar()
    this.spellCaster = new SpellCaster(this.player, this.mastery, this.grimoire)
    this.hud         = new HUD()

    this.evolutionOverlay = new EvolutionOverlay(
      document.getElementById('evolution-overlay-root') as HTMLDivElement,
    )
  }

  start(): void {
    this.inventory.load()
    this.mastery.load()
    this.grimoire.load()
    this.hud.init()
    this.sceneManager.scene.add(this.player.mesh)
    this.showLoadoutScreen()
  }

  // ── LoadoutScreen ──────────────────────────────────────────────────────────

  private showLoadoutScreen(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.running = false
    this.inputManager.captureWheel = false

    this.loadoutScreen = new LoadoutScreen({
      root:           document.getElementById('loadout-root') as HTMLDivElement,
      inventory:      this.inventory,
      mastery:        this.mastery,
      grimoire:       this.grimoire,
      onEnterDungeon: () => this.startRun(),
    })
    this.loadoutScreen.show()
  }

  // ── Start run ─────────────────────────────────────────────────────────────

  private startRun(): void {
    if (this.loadoutScreen) { this.loadoutScreen.dispose(); this.loadoutScreen = null }

    this.spellBar.loadFromLoadout(this.inventory.activeLoadout)
    this.spellBar.activeBar = 1
    this.spellCaster.clearCooldowns()
    this.runData.reset()

    this.player.hp       = this.player.maxHp
    this.player.mana     = this.player.maxMana
    this.player.position.set(0, 0.75, 0)
    this.player.flasks    = this.player.maxFlasks
    this.player.isHealing = false
    this.player.healTimer = 0
    this.player.isDodging = false
    this.player.dodgeTimer = 0
    this.player.dodgeCooldownTimer = 0
    this.player.isDying = false
    this.player.deathTimer = 0
    this.player.mesh.scale.set(1, 1, 1)
    const pmat = this.player.mesh.material as THREE.MeshStandardMaterial
    pmat.transparent = false
    pmat.opacity = 1

    const seed = Math.floor(Math.random() * 0xFFFFFF)
    this.session.init(this.sceneManager.scene, this.sceneManager, seed)

    this.session.onEnemyDied = () => {
      this.runData.enemiesDefeated++
      // 15% chance to drop a flask charge
      if (Math.random() < 0.15) {
        if (this.player.addFlask()) {
          this.hud.pulseFlask()
        }
      }
    }

    this.session.onOrbCollected = (spellIds) => {
      this.runData.recordBookCollected(spellIds)
    }

    this.projectiles   = []
    this.activeEffects = []
    this.lastRoomCleared = false

    this.running = true
    this.inputManager.captureWheel = true
    this.clock.start()
    this.rafId = requestAnimationFrame(this.loop)
  }

  // ── Game loop ──────────────────────────────────────────────────────────────

  private loop = (): void => {
    if (!this.running) return
    this.rafId = requestAnimationFrame(this.loop)

    const delta       = Math.min(this.clock.getDelta(), DELTA_CAP)
    const currentTime = this.clock.getElapsedTime()

    // Death animation — skip all gameplay, just animate and render
    if (this.player.isDying) {
      if (this.player.updateDeath(delta)) {
        this.endRun('death')
      }
      this.sceneManager.followPlayer(this.player.position)
      this.sceneManager.render()
      return
    }

    this.inputManager.update()

    this.player.update(delta, this.inputManager, this.session.activeRoomBounds, this.sceneManager.angle, this.session.activeRoomObstacles)

    // Mouse → world
    this.mouseNDC.set(this.inputManager.mouseX, this.inputManager.mouseY)
    this.mouseRaycaster.setFromCamera(this.mouseNDC, this.sceneManager.camera)
    const hit = new THREE.Vector3()
    if (this.mouseRaycaster.ray.intersectPlane(this.floorPlane, hit)) {
      this.mouseWorld.copy(hit)
    }

    const wheelDelta = this.inputManager.consumeWheelDelta()
    if (wheelDelta !== 0) this.sceneManager.rotateCamera(wheelDelta)

    if (!this.player.isHealing && !this.player.isDodging) {
      if (this.inputManager.isJustPressed('Tab')) {
        this.spellBar.toggleBar()
        this.hud.onBarToggle()
      }

      for (let slotIdx = 0; slotIdx < 4; slotIdx++) {
        if (this.inputManager.isJustPressed(SLOT_KEYS[slotIdx])) {
          this.attemptCast(slotIdx, currentTime)
        }
      }

      // Flask usage — Shift key
      if (this.inputManager.isJustPressed('ShiftLeft') || this.inputManager.isJustPressed('ShiftRight')) {
        if (this.player.useFlask()) {
          this.hud.dimFlask()
        }
      }

      // Dodge roll — Space key
      if (this.inputManager.isJustPressed('Space')) {
        this.player.startDodge(this.sceneManager.angle, this.inputManager)
      }
    }

    // Track damage taken (compare HP before/after session tick)
    const hpBefore = this.player.hp

    this.session.update(delta, this.player, this.sceneManager.scene)

    const hpAfter = this.player.hp
    if (hpAfter < hpBefore) {
      this.runData.damageTaken += hpBefore - hpAfter
    }

    // Track room clears
    const roomNowCleared = this.session.currentRoomData?.cleared ?? false
    if (roomNowCleared && !this.lastRoomCleared) {
      this.runData.roomsCleared++
    }
    this.lastRoomCleared = roomNowCleared

    // Homing targets
    for (const proj of this.projectiles) {
      if (proj.spell.id === 'arcane_missile') {
        const target = this.nearestAliveEnemy(proj.mesh.position)
        proj.homingTarget = target?.position
      }
    }

    const bounds = this.session.activeRoomBounds
    for (const proj of this.projectiles) {
      proj.update(delta, bounds, this.sceneManager.scene, this.session.activeRoomObstacles)
    }

    this.checkProjectileCollisions(currentTime)
    this.projectiles = this.projectiles.filter(p => p.alive)

    for (const effect of this.activeEffects) {
      effect.update(delta, this.sceneManager.scene, this.session.activeEnemies)
    }
    this.activeEffects = this.activeEffects.filter(e => e.alive)

    this.sceneManager.followPlayer(this.player.position)

    const bossEnemy = this.session.bossEnemy
    this.hud.update(
      this.player,
      this.spellCaster,
      this.spellBar,
      currentTime,
      this.session.dungeonData,
      this.session.currentRoomData?.id,
      bossEnemy ? { hp: bossEnemy.hp, maxHp: bossEnemy.maxHp, phase: bossEnemy.phase } : null,
    )
    this.sceneManager.render()

    // Win condition: boss room cleared
    if (
      this.session.currentRoomData?.type === 'boss' &&
      this.session.currentRoomData.cleared
    ) {
      this.endRun('victory')
      return
    }

    // Death condition
    if (this.player.hp <= 0 && !this.player.isDying) {
      this.player.startDying()
    }
  }

  // ── End run ───────────────────────────────────────────────────────────────

  private endRun(reason: 'death' | 'victory'): void {
    this.running = false
    cancelAnimationFrame(this.rafId)

    this.mastery.save()
    this.grimoire.save()
    this.inventory.save()

    const totalRuns = parseInt(localStorage.getItem('total_runs') ?? '0', 10) + 1
    localStorage.setItem('total_runs', String(totalRuns))
    if (reason === 'victory') {
      const totalWins = parseInt(localStorage.getItem('total_wins') ?? '0', 10) + 1
      localStorage.setItem('total_wins', String(totalWins))
    }

    this.evolutionOverlay.dispose()

    this.runSummaryScreen = new RunSummaryScreen({
      root:       document.getElementById('run-summary-root') as HTMLDivElement,
      runData:    this.runData,
      inventory:  this.inventory,
      reason,
      onContinue: (collectedSpellPool) => this.showRewardPhase(collectedSpellPool),
    })
    this.runSummaryScreen.show()
  }

  // ── Return to loadout ──────────────────────────────────────────────────────

  private returnToLoadout(): void {
    if (this.runSummaryScreen) { this.runSummaryScreen.dispose(); this.runSummaryScreen = null }
    this.session.dispose(this.sceneManager.scene)
    this.projectiles   = []
    this.activeEffects = []
    this.showLoadoutScreen()
  }

  // ── Reward spellbook ─────────────────────────────────────────────────────

  private showRewardPhase(spellPool: string[]): void {
    if (this.runSummaryScreen) { this.runSummaryScreen.dispose(); this.runSummaryScreen = null }
    this.inputManager.captureWheel = false

    const root = document.getElementById('loadout-root') as HTMLDivElement

    const rewardBook = new Spellbook({
      root,
      owner: 'enemy',
      spells: spellPool,
      inventory: this.inventory,
      booksCollected: this.runData.collectedBooks.length,
      maxPicks: 3,
      onConfirm: (result) => {
        if (result.claimedSpells) {
          for (const spellId of result.claimedSpells) {
            this.inventory.addToPool(spellId)
            this.grimoire.absorbBook([spellId])
          }
        }
        rewardBook.dispose()
        this.returnToLoadout()
      },
    })
    rewardBook.show()
  }

  // ── Casting ───────────────────────────────────────────────────────────────

  private attemptCast(slotIdx: number, currentTime: number): void {
    const spell = this.spellBar.getSpellAtSlot(slotIdx as 0 | 1 | 2 | 3)
    if (!spell) return

    const mouseDir = new THREE.Vector3()
      .subVectors(this.mouseWorld, this.player.position)
      .setY(0)

    if (mouseDir.lengthSq() < 0.001) {
      mouseDir.copy(this.player.lastDirection)
    } else {
      mouseDir.normalize()
    }

    const result = this.spellCaster.cast(
      spell, this.player, [], this.sceneManager.scene, currentTime, mouseDir,
    )

    const barIndex = (this.spellBar.activeBar - 1) as 0 | 1
    if (!result.success) {
      this.hud.onCastFail(barIndex, slotIdx)
      return
    }

    this.hud.onCastSuccess(barIndex, slotIdx)
    this.runData.recordCast(spell.id)

    if (result.projectile) {
      this.projectiles.push(result.projectile)
      return
    }

    if (result.spellId) {
      this.handleSpecialSpell(result.spellId, mouseDir)
    }
  }

  private handleSpecialSpell(spellId: string, direction: THREE.Vector3): void {
    const scene   = this.sceneManager.scene
    const pos     = this.player.position.clone()
    const enemies = this.session.activeEnemies.filter(e => e.alive)

    switch (spellId) {
      case 'blink':
        castBlink(this.player.position, this.player.mesh, this.player.lastDirection)
        break
      case 'frozen_nova':
        this.activeEffects.push(new FrozenNovaEffect(pos, enemies, SPELLS.frozen_nova.damage, scene, SPELLS.frozen_nova.statusEffect))
        break
      case 'ice_wall':
        this.activeEffects.push(new IceWallEffect(pos, direction, scene))
        break
      case 'thunder_clap':
        this.activeEffects.push(new ThunderClapEffect(pos, enemies, SPELLS.thunder_clap.damage, SPELLS.thunder_clap.radius ?? 5, scene, SPELLS.thunder_clap.statusEffect))
        break
      case 'arcane_explosion':
        this.activeEffects.push(new ArcaneExplosionEffect(pos, enemies, SPELLS.arcane_explosion.damage, SPELLS.arcane_explosion.radius ?? 6, scene))
        break
      case 'static_field': {
        this.activeEffects.push(new StaticFieldEffect(this.mouseWorld.clone(), scene))
        break
      }
      case 'mana_siphon': {
        const nearest = this.nearestAliveEnemy(this.player.position)
        if (nearest && this.player.position.distanceTo(nearest.position) <= (SPELLS.mana_siphon.range ?? 8)) {
          nearest.takeDamage(SPELLS.mana_siphon.damage, scene)
          this.player.mana = Math.min(this.player.maxMana, this.player.mana + 15)
        }
        break
      }
    }
  }

  private checkProjectileCollisions(_currentTime: number): void {
    const enemies: Enemy[] = this.session.activeEnemies

    for (const proj of this.projectiles) {
      if (!proj.alive) continue

      for (const enemy of enemies) {
        if (!enemy.alive) continue

        const projRadius = Math.max(proj.spell.projectileScale.x, proj.spell.projectileScale.z) * 0.5
        const hit = circleVsRect(
          proj.mesh.position.x, proj.mesh.position.z, projRadius,
          enemy.position.x - ENEMY_HALF_X, enemy.position.x + ENEMY_HALF_X,
          enemy.position.z - ENEMY_HALF_Z, enemy.position.z + ENEMY_HALF_Z,
        )

        if (!hit) continue

        if (proj.spell.radius && proj.spell.radius > 0) {
          const r2 = proj.spell.radius * proj.spell.radius
          const impactPos = proj.mesh.position.clone()
          for (const other of enemies) {
            if (!other.alive) continue
            const dx = other.position.x - impactPos.x
            const dz = other.position.z - impactPos.z
            if (dx * dx + dz * dz <= r2) {
              other.takeDamage(proj.damage, this.sceneManager.scene)
              this.runData.damageDealt += proj.damage
              if (proj.spell.statusEffect) other.applyStatusEffect(proj.spell.statusEffect)
            }
          }
        } else {
          enemy.takeDamage(proj.damage, this.sceneManager.scene)
          this.runData.damageDealt += proj.damage
          if (proj.spell.statusEffect) enemy.applyStatusEffect(proj.spell.statusEffect)
        }

        if (proj.spell.element === 'ice') {
          this.activeEffects.push(new FrostDecalEffect(proj.mesh.position.clone(), this.sceneManager.scene))
        }

        if (proj.spell.id === 'chain_lightning' && proj.jumpsRemaining > 0) {
          const nextTarget = this.findChainTarget(enemy, enemies)
          if (nextTarget) {
            const from = proj.mesh.position.clone()
            const to   = nextTarget.position.clone()
            this.activeEffects.push(new LightningBoltEffect(from, to, this.sceneManager.scene))
            const jumpDir = new THREE.Vector3().subVectors(to, from).setY(0).normalize()
            const jumpProj = new Projectile(from.setY(0.75), jumpDir, proj.spell, this.sceneManager.scene, proj.jumpsRemaining - 1)
            this.projectiles.push(jumpProj)
          }
        }

        proj.destroy(this.sceneManager.scene)
        break
      }
    }
  }

  private findChainTarget(hitEnemy: Enemy, allEnemies: Enemy[]): Enemy | null {
    const jumpRange = 6
    let nearest: Enemy | null = null
    let minDist = Infinity
    for (const e of allEnemies) {
      if (!e.alive || e === hitEnemy) continue
      const d = hitEnemy.position.distanceTo(e.position)
      if (d < jumpRange && d < minDist) { minDist = d; nearest = e }
    }
    return nearest
  }

  private nearestAliveEnemy(from: THREE.Vector3): Enemy | null {
    let nearest: Enemy | null = null
    let minDist = Infinity
    for (const e of this.session.activeEnemies) {
      if (!e.alive) continue
      const d = from.distanceTo(e.position)
      if (d < minDist) { minDist = d; nearest = e }
    }
    return nearest
  }
}
