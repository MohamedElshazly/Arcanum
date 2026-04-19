import * as THREE        from 'three'
import { SceneManager }  from './SceneManager'
import { InputManager }  from './InputManager'
import { Player }        from '../entities/Player'
import { Projectile }    from '../entities/Projectile'
import { SpellCaster }   from '../spells/SpellCaster'
import { SpellBar }      from '../spells/SpellBar'
import { HUD }           from '../ui/HUD'
import { DungeonSession } from '../dungeon/DungeonSession'
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

  constructor() {
    this.sceneManager = new SceneManager()
    this.inputManager = new InputManager()
    this.player       = new Player()
    this.spellCaster  = new SpellCaster(this.player)
    this.spellBar     = new SpellBar()
    this.hud          = new HUD()
    this.session      = new DungeonSession()
  }

  start(): void {
    const seed = Math.floor(Math.random() * 0xFFFFFF)
    this.session.init(this.sceneManager.scene, this.sceneManager, seed)
    this.sceneManager.scene.add(this.player.mesh)
    this.hud.init()
    this.clock.start()
    requestAnimationFrame(this.loop)
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop)

    const delta       = Math.min(this.clock.getDelta(), DELTA_CAP)
    const currentTime = this.clock.getElapsedTime()

    this.inputManager.update()

    this.player.update(delta, this.inputManager, this.session.activeRoomBounds, this.sceneManager.angle, this.session.activeRoomObstacles)

    // Project mouse NDC → world floor position
    this.mouseNDC.set(this.inputManager.mouseX, this.inputManager.mouseY)
    this.mouseRaycaster.setFromCamera(this.mouseNDC, this.sceneManager.camera)
    const hit = new THREE.Vector3()
    if (this.mouseRaycaster.ray.intersectPlane(this.floorPlane, hit)) {
      this.mouseWorld.copy(hit)
    }

    // Camera rotation: scroll wheel
    const wheelDelta = this.inputManager.consumeWheelDelta()
    if (wheelDelta !== 0) this.sceneManager.rotateCamera(wheelDelta)

    // Bar toggle
    if (this.inputManager.isJustPressed('Tab')) {
      this.spellBar.toggleBar()
      this.hud.onBarToggle()
    }

    // Spell casting: Q=0, W=1, E=2, R=3
    for (let slotIdx = 0; slotIdx < 4; slotIdx++) {
      if (this.inputManager.isJustPressed(SLOT_KEYS[slotIdx])) {
        this.attemptCast(slotIdx, currentTime)
      }
    }

    this.session.update(delta, this.player, this.sceneManager.scene)

    // Update homing targets for arcane_missile
    for (const proj of this.projectiles) {
      if (proj.spell.id === 'arcane_missile') {
        const target = this.nearestAliveEnemy(proj.mesh.position)
        proj.homingTarget = target?.position
      }
    }

    const bounds = this.session.activeRoomBounds
    for (const proj of this.projectiles) {
      proj.update(delta, bounds, this.sceneManager.scene)
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
  }

  private attemptCast(slotIdx: number, currentTime: number): void {
    const spell = this.spellBar.getSpellAtSlot(slotIdx as 0 | 1 | 2 | 3)
    if (!spell) return

    // Direction: mouse cursor position relative to player
    const mouseDir = new THREE.Vector3()
      .subVectors(this.mouseWorld, this.player.position)
      .setY(0)

    if (mouseDir.lengthSq() < 0.001) {
      mouseDir.copy(this.player.lastDirection)
    } else {
      mouseDir.normalize()
    }

    const result = this.spellCaster.cast(
      spell,
      this.player,
      [],
      this.sceneManager.scene,
      currentTime,
      mouseDir,
    )

    const barIndex = (this.spellBar.activeBar - 1) as 0 | 1
    if (!result.success) {
      this.hud.onCastFail(barIndex, slotIdx)
      return
    }

    this.hud.onCastSuccess(barIndex, slotIdx)

    if (result.projectile) {
      if (spell.id === 'chain_lightning') {
        result.projectile.jumpsRemaining = 3
      }
      this.projectiles.push(result.projectile)
      return
    }

    // Handle non-projectile spells
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
        this.activeEffects.push(
          new FrozenNovaEffect(pos, enemies, SPELLS.frozen_nova.damage, scene),
        )
        break

      case 'ice_wall':
        this.activeEffects.push(new IceWallEffect(pos, direction, scene))
        break

      case 'thunder_clap':
        this.activeEffects.push(
          new ThunderClapEffect(pos, enemies, SPELLS.thunder_clap.damage, SPELLS.thunder_clap.radius ?? 5, scene),
        )
        break

      case 'arcane_explosion':
        this.activeEffects.push(
          new ArcaneExplosionEffect(pos, enemies, SPELLS.arcane_explosion.damage, SPELLS.arcane_explosion.radius ?? 6, scene),
        )
        break

      case 'static_field': {
        const targetPos = this.mouseWorld.clone()
        this.activeEffects.push(new StaticFieldEffect(targetPos, scene))
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

        const projRadius = Math.max(
          proj.spell.projectileScale.x,
          proj.spell.projectileScale.z,
        ) * 0.5

        const hit = circleVsRect(
          proj.mesh.position.x, proj.mesh.position.z,
          projRadius,
          enemy.position.x - ENEMY_HALF_X,
          enemy.position.x + ENEMY_HALF_X,
          enemy.position.z - ENEMY_HALF_Z,
          enemy.position.z + ENEMY_HALF_Z,
        )

        if (!hit) continue

        // AOE on impact (e.g. Pyroblast)
        if (proj.spell.radius && proj.spell.radius > 0) {
          const r2 = proj.spell.radius * proj.spell.radius
          const impactPos = proj.mesh.position.clone()
          for (const other of enemies) {
            if (!other.alive) continue
            const dx = other.position.x - impactPos.x
            const dz = other.position.z - impactPos.z
            if (dx * dx + dz * dz <= r2) {
              other.takeDamage(proj.damage, this.sceneManager.scene)
            }
          }
        } else {
          enemy.takeDamage(proj.damage, this.sceneManager.scene)
        }

        // Ice impact frost decal
        if (proj.spell.element === 'ice') {
          this.activeEffects.push(
            new FrostDecalEffect(proj.mesh.position.clone(), this.sceneManager.scene),
          )
        }

        // Chain lightning: jump to next enemy
        if (proj.spell.id === 'chain_lightning' && proj.jumpsRemaining > 0) {
          const nextTarget = this.findChainTarget(enemy, enemies)
          if (nextTarget) {
            const from = proj.mesh.position.clone()
            const to   = nextTarget.position.clone()
            this.activeEffects.push(
              new LightningBoltEffect(from, to, this.sceneManager.scene),
            )
            const jumpDir = new THREE.Vector3()
              .subVectors(to, from)
              .setY(0)
              .normalize()
            const jumpProj = new Projectile(
              from.setY(0.75),
              jumpDir,
              proj.spell,
              this.sceneManager.scene,
              proj.jumpsRemaining - 1,
            )
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
      if (d < jumpRange && d < minDist) {
        minDist = d
        nearest = e
      }
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
