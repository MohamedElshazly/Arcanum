import * as THREE from 'three'
import { generateDungeon }    from './DungeonGenerator'
import { assignBiomes }       from './BiomeAssigner'
import { Room }               from './Room'
import { HazardSystem }       from './HazardSystem'
import { DungeonRenderer }    from './DungeonRenderer'
import { BIOMES }             from './BiomeDefinitions'
import { mulberry32 }         from '../utils/MathUtils'
import { Enemy }              from '../entities/Enemy'
import { Projectile }         from '../entities/Projectile'
import { SpellBookOrb }       from '../entities/SpellBookOrb'
import { circleVsRect }       from '../utils/CollisionUtils'
import {
  OPPOSITE_DIR, getNeighborRoom,
  type DungeonData, type RoomData, type Direction,
} from './DungeonGenerator'
import type { DifficultyMultipliers } from '../progression/DifficultySystem'
import type { DifficultyStatMultipliers } from '../entities/Enemy'
import type { Player }        from '../entities/Player'
import type { SceneManager }  from '../core/SceneManager'
import { PLAYER_RADIUS }      from '../constants'

type TransitionState = 'idle' | 'fade-out' | 'fade-in'

const FADE_DURATION = 0.3

export class DungeonSession {
  private dungeon!:         DungeonData
  private activeRoomData!:  RoomData
  private activeRoom!:      Room
  private enemies:          Enemy[]       = []
  private enemyProjectiles: Projectile[]  = []
  private orbs:             SpellBookOrb[] = []
  private hazards:          HazardSystem  = new HazardSystem()
  private renderer!:        DungeonRenderer
  private sm!:              SceneManager
  private transitionState:  TransitionState = 'idle'
  private fadeTimer         = 0
  private pendingDir:       Direction | null = null
  private overlay:          HTMLElement | null = null
  private shrineUsed        = false
  private diffMultipliers:  DifficultyMultipliers | null = null

  /** Called when an enemy dies. Game.ts wires this up. */
  onEnemyDied: (() => void) | null = null

  /** Called when a spellbook orb is collected by the player. */
  onOrbCollected: ((spellIds: string[]) => void) | null = null

  init(scene: THREE.Scene, sm: SceneManager, seed: number, diffMultipliers?: DifficultyMultipliers): void {
    this.sm       = sm
    this.renderer = new DungeonRenderer(sm)
    this.overlay  = document.getElementById('fade-overlay')
    this.diffMultipliers = diffMultipliers ?? null

    this.dungeon = generateDungeon(seed)
    assignBiomes(this.dungeon, mulberry32(seed + 9999), diffMultipliers?.enemyCount)

    this.activateRoom(this.dungeon.startRoom, scene, null)
  }

  get currentRoomData():    RoomData    { return this.activeRoomData }
  get dungeonData():        DungeonData { return this.dungeon }
  get activeEnemies():      Enemy[]     { return this.enemies }
  get activeOrbs():         SpellBookOrb[] { return this.orbs }
  get activeRoomBounds()  { return this.activeRoom?.bounds ?? { minX: -9, maxX: 9, minZ: -9, maxZ: 9 } }
  get activeRoomObstacles() { return this.activeRoom?.obstacles ?? [] }
  get bossEnemy(): Enemy | null {
    return this.enemies.find(e => e.alive && e.isBoss) ?? null
  }

  update(delta: number, player: Player, scene: THREE.Scene): void {
    this.renderer.update(delta, scene)

    switch (this.transitionState) {
      case 'idle':
        this.idleTick(delta, player, scene)
        break
      case 'fade-out':
        this.fadeTimer += delta
        this.setOverlayOpacity(this.fadeTimer / FADE_DURATION)
        if (this.fadeTimer >= FADE_DURATION) {
          this.commitTransition(player, scene)
          this.transitionState = 'fade-in'
          this.fadeTimer = 0
        }
        break
      case 'fade-in':
        this.fadeTimer += delta
        this.setOverlayOpacity(1 - this.fadeTimer / FADE_DURATION)
        if (this.fadeTimer >= FADE_DURATION) {
          this.setOverlayOpacity(0)
          this.transitionState = 'idle'
          this.fadeTimer = 0
          if (!this.activeRoomData.visited) {
            this.showBiomeDescription(this.activeRoomData)
          }
          this.activeRoomData.visited = true
        }
        break
    }
  }

  /** Full cleanup — call when returning to LoadoutScreen between runs. */
  dispose(scene: THREE.Scene): void {
    this.clearRoom(scene)
    this.transitionState = 'idle'
    this.fadeTimer       = 0
    this.pendingDir      = null
    this.setOverlayOpacity(0)
  }

  private idleTick(delta: number, player: Player, scene: THREE.Scene): void {
    this.activeRoom.update(delta)
    const obstacles = this.activeRoom.obstacles

    for (const enemy of this.enemies) {
      const projs = enemy.update(delta, player.position, this.activeRoom.bounds, scene, obstacles)
      this.enemyProjectiles.push(...projs)
    }

    // Detect newly dead enemies → spawn orbs
    const justDied = this.enemies.filter(e => !e.alive)
    for (const dead of justDied) {
      this.spawnOrb(dead, scene)
    }
    this.enemies = this.enemies.filter(e => e.alive)

    for (const p of this.enemyProjectiles) {
      p.update(delta, this.activeRoom.bounds, scene, this.activeRoom.obstacles)
    }
    this.checkEnemyProjectilePlayerCollisions(player, scene)
    this.enemyProjectiles = this.enemyProjectiles.filter(p => p.alive)

    // Update orbs
    for (const orb of this.orbs) {
      orb.update(delta, player.position)
    }
    for (const orb of this.orbs) {
      if (orb.collected) {
        this.onOrbCollected?.(orb.ownedSpellIds)
        orb.dispose(scene)
      }
    }
    this.orbs = this.orbs.filter(o => !o.collected)

    this.hazards.update(delta, player, scene)

    if (!this.activeRoomData.cleared && this.enemies.length === 0) {
      this.activeRoomData.cleared = true
      this.activeRoom.openAllDoors(scene)
    }

    if (this.activeRoomData.type === 'rest' && !this.shrineUsed) {
      if (player.position.distanceTo(new THREE.Vector3(0, 0, 0)) < 2) {
        player.hp     = player.maxHp
        player.flasks = player.maxFlasks
        player.mana   = Math.min(player.maxMana, player.mana + 30)
        this.shrineUsed = true
        this.flashPlayer(player)
      }
    }

    if (this.activeRoomData.cleared) {
      const crossed = this.activeRoom.checkDoorCrossing(player.position)
      if (crossed && this.activeRoomData.connections.includes(crossed)) {
        this.pendingDir      = crossed
        this.transitionState = 'fade-out'
        this.fadeTimer       = 0
      }
    }
  }

  private spawnOrb(enemy: Enemy, scene: THREE.Scene): void {
    if (enemy.ownedSpellIds.length === 0) return
    const orb = new SpellBookOrb(
      enemy.position.clone(),
      enemy.ownedSpellIds,
      enemy.dominantElement,
      scene,
    )
    this.orbs.push(orb)
    this.onEnemyDied?.()
  }

  private commitTransition(player: Player, scene: THREE.Scene): void {
    if (!this.pendingDir) return
    const dir      = this.pendingDir
    const nextData = getNeighborRoom(this.dungeon.grid, this.activeRoomData, dir)
    if (!nextData) return

    this.clearRoom(scene)
    this.activateRoom(nextData, scene, OPPOSITE_DIR[dir])

    const spawnPos = this.activeRoom.getSpawnPosition(OPPOSITE_DIR[dir])
    player.position.set(spawnPos.x, player.position.y, spawnPos.z)
    this.pendingDir = null

    this.sm.followPlayer(player.position)
  }

  private activateRoom(roomData: RoomData, scene: THREE.Scene, _enterFrom: Direction | null): void {
    this.activeRoomData = roomData
    const biome = BIOMES[roomData.biome]

    this.activeRoom = new Room(roomData, biome)
    this.activeRoom.build(scene)

    this.renderer.applyBiome(biome, scene)

    const diffStatMult: DifficultyStatMultipliers | undefined = this.diffMultipliers
      ? { enemyHp: this.diffMultipliers.enemyHp, enemySpeed: this.diffMultipliers.enemySpeed, bossHp: this.diffMultipliers.bossHp }
      : undefined

    this.enemies = roomData.enemies.map(spawn =>
      new Enemy({ archetype: spawn.archetype, spellIds: spawn.spellIds, x: spawn.position.x, z: spawn.position.z, depth: spawn.depth, difficultyMult: diffStatMult, bossVariant: spawn.bossVariant })
    )
    for (const e of this.enemies) scene.add(e.mesh)

    this.hazards.spawnForRoom(roomData, biome.hazards, scene, this.hashRoomId(roomData.id))

    this.shrineUsed = false
  }

  private clearRoom(scene: THREE.Scene): void {
    this.activeRoom?.dispose(scene)
    for (const e of this.enemies) e.dispose(scene)
    for (const p of this.enemyProjectiles) p.destroy(scene)
    for (const o of this.orbs) o.dispose(scene)
    this.enemies          = []
    this.enemyProjectiles = []
    this.orbs             = []
    this.hazards.clear(scene)
    this.renderer.clear(scene)
  }

  private checkEnemyProjectilePlayerCollisions(player: Player, scene: THREE.Scene): void {
    for (const proj of this.enemyProjectiles) {
      if (!proj.alive) continue
      const r = Math.max(proj.spell.projectileScale.x, proj.spell.projectileScale.z) * 0.5
      const hit = circleVsRect(
        proj.mesh.position.x, proj.mesh.position.z, r,
        player.position.x - PLAYER_RADIUS, player.position.x + PLAYER_RADIUS,
        player.position.z - PLAYER_RADIUS, player.position.z + PLAYER_RADIUS,
      )
      if (hit) { player.takeDamage(proj.damage); proj.destroy(scene) }
    }
  }

  private flashPlayer(player: Player): void {
    const mat = player.mesh.material as THREE.MeshStandardMaterial
    mat.emissive.set(0x00ff44)
    mat.emissiveIntensity = 1
    setTimeout(() => { mat.emissive.set(0x222222); mat.emissiveIntensity = 0 }, 300)
  }

  private showBiomeDescription(room: RoomData): void {
    const biome = BIOMES[room.biome]
    const el    = document.getElementById('biome-desc')
    if (!el) return
    el.textContent = biome.description
    el.classList.remove('fade-desc')
    void el.offsetWidth
    el.classList.add('fade-desc')
  }

  private setOverlayOpacity(t: number): void {
    if (this.overlay) this.overlay.style.opacity = String(Math.max(0, Math.min(1, t)))
  }

  private hashRoomId(id: string): number {
    let h = 0
    for (const c of id) h = (Math.imul(31, h) + c.charCodeAt(0)) >>> 0
    return h
  }
}
