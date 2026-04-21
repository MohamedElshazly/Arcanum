import * as THREE  from 'three'
import { SPELLS }  from '../spells/SpellDefinitions'
import type { Spell, StatusEffect, StatusEffectType } from '../spells/SpellDefinitions'
import { Projectile } from './Projectile'
import type { RoomBounds, Obstacle } from '../dungeon/Room'

export type EnemyArchetype = 'apprentice' | 'battle_mage' | 'warlock' | 'boss'

export interface EnemyConfig {
  archetype: EnemyArchetype
  spellIds:  string[]
  x: number
  z: number
  depth: number
}

export interface ScaledStats {
  hp: number; speed: number; castInterval: number; spellCount: number
}

const BASE_HP:    Record<EnemyArchetype, number> = { apprentice: 40, battle_mage: 80, warlock: 100, boss: 500 }
const BASE_SPEED: Record<EnemyArchetype, number> = { apprentice: 2.5, battle_mage: 1.8, warlock: 2.2, boss: 1.4 }

export function scaleEnemyStats(archetype: EnemyArchetype, depth: number): ScaledStats {
  const hpD    = Math.min(depth, archetype === 'boss' ? 12 : 8)
  const speedD = Math.min(depth, archetype === 'boss' ? 10 : 6)
  const baseInterval = archetype === 'boss' ? 2.3 : archetype === 'warlock' ? 1.6 : 2.0
  const minInterval  = archetype === 'boss' ? 0.8 : archetype === 'warlock' ? 0.6 : 0.8
  return {
    hp:           Math.round(BASE_HP[archetype] * Math.pow(1.15, hpD)),
    speed:        BASE_SPEED[archetype] * Math.pow(1.05, speedD),
    castInterval: Math.max(minInterval, baseInterval - depth * 0.1),
    spellCount:   depth <= 2 ? 2 : depth <= 4 ? 3 : 4,
  }
}

const ELEMENT_COLOR: Record<string, number> = {
  fire: 0xcc4400, ice: 0x4499cc, lightning: 0xcccc00, arcane: 0x9944cc,
}

const ENEMY_RADIUS = 0.5

interface BlinkTelegraph {
  timer:       number
  destination: THREE.Vector3
  originRing:  THREE.Mesh
  destRing:    THREE.Mesh
  line:        THREE.Line
  isCharge:    boolean
}

interface ActiveStatusEffect {
  type:       StatusEffectType
  remaining:  number
  value?:     number
}

export class Enemy {
  readonly mesh:     THREE.Mesh
  readonly position: THREE.Vector3
  hp:    number
  maxHp: number
  alive  = true

  private readonly stats:     ScaledStats
  private readonly archetype: EnemyArchetype
  private readonly depth:     number
  private spells: Spell[]    = []
  private castTimer           = 0
  private aggressionRange:    number
  private telegraph:          BlinkTelegraph | null = null
  private ghostTimer          = 0
  private ghostMesh:          THREE.Mesh | null = null
  private orbitalRing:        THREE.Mesh | null = null
  private orbitalAngle        = 0
  private blinkCooldown       = 0

  // Status effects
  private statusEffects: ActiveStatusEffect[] = []
  private readonly originalEmissive: THREE.Color

  // Death animation
  private dying      = false
  private dyingTimer = 0

  // Boss-specific
  private bossTrackedPhase: 1 | 2 | 3 = 1
  private bossPhaseBreak   = 0
  private bossQueue:  Array<{ spell: Spell; dir: THREE.Vector3 }> = []
  private bossQueueTimer = 0

  constructor(config: EnemyConfig) {
    this.archetype = config.archetype
    this.depth     = config.depth
    this.stats     = scaleEnemyStats(config.archetype, config.depth)
    this.hp        = this.stats.hp
    this.maxHp     = this.stats.hp

    this.aggressionRange = 9999

    this.spells = config.spellIds.map(id => SPELLS[id]).filter(Boolean)

    if (config.archetype === 'boss') {
      const geo = new THREE.CylinderGeometry(0.9, 1.1, 2.8, 6)
      const mat = new THREE.MeshStandardMaterial({
        color:             0x110022,
        emissive:          new THREE.Color(0x8800cc),
        emissiveIntensity: 1.5,
      })
      this.mesh = new THREE.Mesh(geo, mat)
      this.mesh.position.set(config.x, 1.4, config.z)

      const ringGeo = new THREE.TorusGeometry(1.8, 0.1, 8, 48)
      const ringMat = new THREE.MeshStandardMaterial({
        color:             0xaa44ff,
        emissive:          new THREE.Color(0x6600aa),
        emissiveIntensity: 2,
      })
      this.orbitalRing = new THREE.Mesh(ringGeo, ringMat)
      this.mesh.add(this.orbitalRing)
    } else if (config.archetype === 'warlock') {
      // Triangle shape — cone with 3 radial segments
      const geo = new THREE.ConeGeometry(0.7, 2.0, 3)
      const color = this.dominantColor()
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive:          new THREE.Color(color).multiplyScalar(0.6),
        emissiveIntensity: 1.8,
      })
      this.mesh = new THREE.Mesh(geo, mat)
      this.mesh.position.set(config.x, 1.0, config.z)
    } else {
      const isLarge = config.archetype === 'battle_mage'
      const geo     = new THREE.BoxGeometry(0.8, isLarge ? 1.8 : 1.2, 0.8)
      const color   = this.dominantColor()
      const mat     = new THREE.MeshStandardMaterial({
        color,
        emissive:          new THREE.Color(0x222222),
        emissiveIntensity: 1.0,
      })
      this.mesh     = new THREE.Mesh(geo, mat)
      this.mesh.position.set(config.x, isLarge ? 0.9 : 0.6, config.z)
    }

    this.originalEmissive = (this.mesh.material as THREE.MeshStandardMaterial).emissive.clone()
    this.position  = this.mesh.position
    this.castTimer = Math.random() * this.stats.castInterval
  }

  applyStatusEffect(effect: StatusEffect): void {
    const existing = this.statusEffects.find(e => e.type === effect.type)
    if (existing) {
      existing.remaining = effect.duration
      existing.value     = effect.value
    } else {
      this.statusEffects.push({
        type:      effect.type,
        remaining: effect.duration,
        value:     effect.value,
      })
    }
  }

  get isBoss(): boolean { return this.archetype === 'boss' }

  get phase(): 1 | 2 | 3 {
    const r = this.hp / this.maxHp
    return r > 0.66 ? 1 : r > 0.33 ? 2 : 3
  }

  get dominantElement(): import('../spells/SpellDefinitions').SpellElement {
    return (this.spells[0]?.element ?? 'arcane') as import('../spells/SpellDefinitions').SpellElement
  }

  get ownedSpellIds(): string[] {
    return this.spells.map(s => s.id)
  }

  /** Immediate cleanup — use when transitioning rooms. */
  dispose(scene: THREE.Scene): void {
    if (!this.alive && !this.dying) return
    this.alive  = false
    this.dying  = false
    this.clearTelegraph(scene)
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.MeshStandardMaterial).dispose()
    if (this.ghostMesh) { scene.remove(this.ghostMesh); this.ghostMesh = null }
  }

  private dominantColor(): number {
    if (!this.spells.length) return 0x888888
    return ELEMENT_COLOR[this.spells[0].element] ?? 0x888888
  }

  update(
    delta: number,
    playerPos: THREE.Vector3,
    bounds: RoomBounds,
    scene: THREE.Scene,
    obstacles: readonly Obstacle[] = [],
  ): Projectile[] {
    // ── Death animation ───────────────────────────────────────────────────
    if (this.dying) {
      this.dyingTimer += delta
      const t = Math.min(this.dyingTimer / 0.4, 1)
      const s = 1 - t
      this.mesh.scale.set(s, s, s)
      const mat = this.mesh.material as THREE.MeshStandardMaterial
      mat.transparent = true
      mat.opacity     = 1 - t
      if (this.dyingTimer >= 0.4) {
        this.alive = false
        scene.remove(this.mesh)
        this.mesh.geometry.dispose()
        mat.dispose()
        if (this.ghostMesh) { scene.remove(this.ghostMesh); this.ghostMesh = null }
      }
      return []
    }

    if (!this.alive) return []

    // ── Blink cooldown tick ──────────────────────────────────────────────
    if (this.blinkCooldown > 0) this.blinkCooldown -= delta

    // ── Status effect processing ─────────────────────────────────────────
    let speedMult  = 1.0
    let isFrozen   = false
    let isStunned  = false
    let hasBurning = false
    let hasSlow    = false

    for (const fx of this.statusEffects) {
      switch (fx.type) {
        case 'burning': {
          const dmg = (fx.value ?? 5) * delta
          this.hp -= dmg
          hasBurning = true
          break
        }
        case 'slow':
          speedMult *= (1 - (fx.value ?? 0.5))
          hasSlow = true
          break
        case 'freeze':
          isFrozen = true
          break
        case 'stun':
          isStunned = true
          break
        case 'knockback': {
          const away = new THREE.Vector3()
            .subVectors(this.position, playerPos)
            .setY(0)
            .normalize()
          const kbDist = fx.value ?? 5
          const r = this.archetype === 'boss' ? 1.1 : ENEMY_RADIUS
          this.position.x = Math.max(bounds.minX + r, Math.min(bounds.maxX - r, this.position.x + away.x * kbDist))
          this.position.z = Math.max(bounds.minZ + r, Math.min(bounds.maxZ - r, this.position.z + away.z * kbDist))
          fx.remaining = 0
          break
        }
      }
    }

    // Tick down durations and remove expired
    for (const fx of this.statusEffects) fx.remaining -= delta
    this.statusEffects = this.statusEffects.filter(fx => fx.remaining > 0)

    // Kill check after burning damage
    if (this.hp <= 0 && !this.dying) {
      this.startDying(scene)
      return []
    }

    // Visual feedback — emissive tint based on highest-priority active effect
    const mat = this.mesh.material as THREE.MeshStandardMaterial

    if (isFrozen)            mat.emissive.setHex(0x00ccff)
    else if (hasBurning)     mat.emissive.setHex(0xff6600)
    else if (isStunned)      mat.emissive.setHex(0xffffff)
    else if (hasSlow)        mat.emissive.setHex(0x4444ff)
    else                     mat.emissive.copy(this.originalEmissive)

    // Freeze/stun: skip all AI (movement + casting + blink)
    if (isFrozen || isStunned) return []

    // ── Orbital ring ──────────────────────────────────────────────────────
    if (this.orbitalRing) {
      this.orbitalAngle += delta * (0.8 + (this.phase - 1) * 1.0)
      this.orbitalRing.rotation.y = this.orbitalAngle
      this.orbitalRing.rotation.x = Math.PI / 2 + Math.sin(this.orbitalAngle * 0.5) * 0.4
      const rm = this.orbitalRing.material as THREE.MeshStandardMaterial
      rm.emissiveIntensity = 1.5 + (this.phase - 1) * 1.5
    }

    // ── Ghost fade ────────────────────────────────────────────────────────
    if (this.ghostMesh) {
      this.ghostTimer -= delta
      const gm = this.ghostMesh.material as THREE.MeshStandardMaterial
      gm.opacity = Math.max(0, this.ghostTimer / 0.4)
      if (this.ghostTimer <= 0) { scene.remove(this.ghostMesh); this.ghostMesh = null }
    }

    // ── Telegraph ─────────────────────────────────────────────────────────
    if (this.telegraph) {
      this.telegraph.timer += delta
      const telegraphTime = 0.6
      if (this.telegraph.timer >= telegraphTime) {
        this.executeBlink(this.telegraph.destination, scene)
        this.clearTelegraph(scene)
      }
      return []
    }

    // ── Boss phase transition pause ───────────────────────────────────────
    if (this.archetype === 'boss') {
      const currentPhase = this.phase
      if (currentPhase !== this.bossTrackedPhase) {
        this.bossTrackedPhase = currentPhase
        this.bossPhaseBreak   = 0.6
      }
      if (this.bossPhaseBreak > 0) {
        this.bossPhaseBreak -= delta
        return []
      }
    }

    const dist    = this.position.distanceTo(playerPos)
    if (dist >= this.aggressionRange) return []

    // ── Blink check ───────────────────────────────────────────────────────
    if (this.shouldBlink(dist)) {
      const dest = this.blinkDestination(playerPos, bounds)
      if (dest) {
        this.startTelegraph(dest, scene, this.archetype === 'boss' && this.phase >= 2)
        return []
      }
    }

    // ── Movement with steering ────────────────────────────────────────────
    this.moveToward(delta, playerPos, dist, bounds, obstacles, speedMult)

    // ── Boss queued cast drain ────────────────────────────────────────────
    if (this.archetype === 'boss' && this.bossQueue.length > 0) {
      this.bossQueueTimer -= delta
      if (this.bossQueueTimer <= 0) {
        const next   = this.bossQueue.shift()!
        const origin = this.position.clone().setY(0.75)
        const mod    = { ...next.spell, damage: Math.round(next.spell.damage * 0.75) }
        this.bossQueueTimer = this.phase === 3 ? 0.15 : this.phase === 2 ? 0.25 : 0.4
        return [new Projectile(origin, next.dir, mod, scene)]
      }
      return []
    }

    // ── Cast timer ────────────────────────────────────────────────────────
    this.castTimer -= delta
    if (this.castTimer <= 0 && this.spells.length > 0) {
      this.castTimer = this.activeCastInterval()
      return this.fireProjectiles(playerPos, scene)
    }

    return []
  }

  // ── Cast interval per phase ───────────────────────────────────────────────

  private activeCastInterval(): number {
    if (this.archetype !== 'boss') return this.stats.castInterval
    switch (this.phase) {
      case 1: return this.stats.castInterval * 0.85
      case 2: return this.stats.castInterval * 0.50
      case 3: return this.stats.castInterval * 0.22
    }
  }

  // ── Movement ──────────────────────────────────────────────────────────────

  private moveToward(
    delta: number,
    playerPos: THREE.Vector3,
    dist: number,
    bounds: RoomBounds,
    obstacles: readonly Obstacle[],
    speedMult = 1.0,
  ): void {
    let dx = 0, dz = 0
    const spd = this.stats.speed * speedMult

    if (this.archetype === 'boss') {
      const targetDist = this.phase === 3 ? 3 : this.phase === 2 ? 6 : 10
      const phaseSpd = this.phase === 3 ? spd * 2.5 : this.phase === 2 ? spd * 1.5 : spd
      const dir = new THREE.Vector3().subVectors(playerPos, this.position).setY(0).normalize()
      const perp = new THREE.Vector3(-dir.z, 0, dir.x)

      if (dist < targetDist - 1) {
        dx = -dir.x * spd * delta
        dz = -dir.z * spd * delta
      } else if (dist > targetDist + 1) {
        dx = dir.x * phaseSpd * delta
        dz = dir.z * phaseSpd * delta
      }
      dx += perp.x * spd * 0.3 * delta
      dz += perp.z * spd * 0.3 * delta

    } else if (this.archetype === 'battle_mage') {
      const dir  = new THREE.Vector3().subVectors(playerPos, this.position).setY(0).normalize()
      const perp = new THREE.Vector3(-dir.z, 0, dir.x)
      if (dist < 6) {
        dx = -dir.x * spd * delta
        dz = -dir.z * spd * delta
      } else if (dist > 9) {
        dx = dir.x * spd * delta
        dz = dir.z * spd * delta
      }
      dx += perp.x * spd * 0.4 * delta
      dz += perp.z * spd * 0.4 * delta

    } else if (this.archetype === 'warlock') {
      const dir  = new THREE.Vector3().subVectors(playerPos, this.position).setY(0).normalize()
      const perp = new THREE.Vector3(-dir.z, 0, dir.x)
      if (dist < 4) {
        dx = -dir.x * spd * delta
        dz = -dir.z * spd * delta
      } else if (dist > 7) {
        dx = dir.x * spd * 1.3 * delta
        dz = dir.z * spd * 1.3 * delta
      }
      dx += perp.x * spd * 0.6 * delta
      dz += perp.z * spd * 0.6 * delta

    } else {
      if (dist > 0.5) {
        const dir = new THREE.Vector3().subVectors(playerPos, this.position).setY(0).normalize()
        dx = dir.x * spd * delta
        dz = dir.z * spd * delta
      }
    }

    if (dx === 0 && dz === 0) return
    this.applyMovement(dx, dz, bounds, obstacles)
  }

  private applyMovement(
    dx: number,
    dz: number,
    bounds: RoomBounds,
    obstacles: readonly Obstacle[],
  ): void {
    const len = Math.sqrt(dx * dx + dz * dz)
    if (len === 0) return

    const nx = dx / len
    const nz = dz / len

    // Check 0.5 units ahead
    if (!this.isBlocked(this.position.x + nx * 0.5, this.position.z + nz * 0.5, bounds, obstacles)) {
      this.position.x += dx
      this.position.z += dz
      return
    }

    // Try ±45° deflections
    const c45 = Math.cos(Math.PI / 4)
    const s45 = Math.sin(Math.PI / 4)
    const deflections: [number, number][] = [
      [nx * c45 - nz * s45, nx * s45 + nz * c45],
      [nx * c45 + nz * s45, -nx * s45 + nz * c45],
    ]
    for (const [dnx, dnz] of deflections) {
      if (!this.isBlocked(this.position.x + dnx * 0.5, this.position.z + dnz * 0.5, bounds, obstacles)) {
        this.position.x += dnx * len
        this.position.z += dnz * len
        return
      }
    }
    // Blocked — stay put
  }

  private isBlocked(x: number, z: number, bounds: RoomBounds, obstacles: readonly Obstacle[]): boolean {
    const r = this.archetype === 'boss' ? 1.1 : ENEMY_RADIUS
    if (x - r < bounds.minX || x + r > bounds.maxX) return true
    if (z - r < bounds.minZ || z + r > bounds.maxZ) return true
    for (const obs of obstacles) {
      const dx = x - obs.x
      const dz = z - obs.z
      if (Math.sqrt(dx * dx + dz * dz) < obs.r + r) return true
    }
    return false
  }

  // ── Blink ─────────────────────────────────────────────────────────────────

  private shouldBlink(dist: number): boolean {
    if (this.blinkCooldown > 0) return false
    if (this.archetype === 'boss') {
      return (this.phase === 2 && dist > 14) || (this.phase === 3 && dist > 8)
    }
    if (this.archetype === 'apprentice' && this.depth >= 5) return this.hp / this.maxHp < 0.3
    if (this.archetype === 'battle_mage' && this.depth >= 4) return dist < 3
    if (this.archetype === 'warlock') return dist < 3 || this.hp / this.maxHp < 0.4
    return false
  }

  private blinkDestination(playerPos: THREE.Vector3, bounds: RoomBounds): THREE.Vector3 | null {
    if (this.archetype === 'boss') {
      const dir  = new THREE.Vector3().subVectors(playerPos, this.position).setY(0).normalize()
      const perp = new THREE.Vector3(-dir.z, 0, dir.x)
      const dest = playerPos.clone().addScaledVector(perp, 2.5)
      dest.x = Math.max(bounds.minX + 1, Math.min(bounds.maxX - 1, dest.x))
      dest.z = Math.max(bounds.minZ + 1, Math.min(bounds.maxZ - 1, dest.z))
      return dest
    }
    const away = new THREE.Vector3().subVectors(this.position, playerPos).setY(0).normalize()
    const d    = (this.archetype === 'battle_mage' || this.archetype === 'warlock') && this.depth >= 6 ? -6 : 6
    const dest = this.position.clone().addScaledVector(away, d)
    dest.x = Math.max(bounds.minX + 1, Math.min(bounds.maxX - 1, dest.x))
    dest.z = Math.max(bounds.minZ + 1, Math.min(bounds.maxZ - 1, dest.z))
    return dest
  }

  private startTelegraph(dest: THREE.Vector3, scene: THREE.Scene, isCharge = false): void {
    const color   = isCharge ? 0xff2200 : 0xffffff
    const emColor = new THREE.Color(isCharge ? 0xff2200 : 0xffffff)
    const ringGeo = new THREE.TorusGeometry(0.6, 0.05, 8, 32)
    const mat1    = new THREE.MeshStandardMaterial({ color, emissive: emColor, emissiveIntensity: 2 })

    const originRing = new THREE.Mesh(ringGeo, mat1)
    originRing.position.copy(this.position)
    originRing.rotation.x = Math.PI / 2

    const destRing = new THREE.Mesh(ringGeo.clone(), mat1.clone())
    destRing.position.copy(dest)
    destRing.rotation.x = Math.PI / 2

    const pts    = [this.position.clone(), dest.clone()]
    const line   = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color, opacity: 0.6, transparent: true }),
    )
    scene.add(originRing, destRing, line)
    this.telegraph = { timer: 0, destination: dest, originRing, destRing, line, isCharge }
  }

  private executeBlink(dest: THREE.Vector3, scene: THREE.Scene): void {
    const ghostGeo = this.mesh.geometry.clone()
    const ghostMat = new THREE.MeshStandardMaterial({
      color:       (this.mesh.material as THREE.MeshStandardMaterial).color.clone(),
      transparent: true,
      opacity:     0.8,
    })
    this.ghostMesh  = new THREE.Mesh(ghostGeo, ghostMat)
    this.ghostMesh.position.copy(this.position)
    scene.add(this.ghostMesh)
    this.ghostTimer = 0.4
    this.position.copy(dest)
    this.blinkCooldown = this.archetype === 'boss' ? 3 : 5
  }

  private clearTelegraph(scene: THREE.Scene): void {
    if (!this.telegraph) return
    scene.remove(this.telegraph.originRing, this.telegraph.destRing, this.telegraph.line)
    this.telegraph = null
  }

  // ── Projectile firing ─────────────────────────────────────────────────────

  private fireProjectiles(playerPos: THREE.Vector3, scene: THREE.Scene): Projectile[] {
    const castable = this.spells.filter(s => s.id !== 'blink' && s.id !== 'ice_wall' && s.id !== 'mana_siphon' && s.id !== 'static_field')
    if (!castable.length) return []
    const spell  = castable[Math.floor(Math.random() * castable.length)]
    const base   = new THREE.Vector3().subVectors(playerPos, this.position).setY(0).normalize()

    if (this.archetype !== 'boss') {
      const dmg = Math.round(spell.damage * 0.65 * (1 + 0.08 * Math.min(this.depth, 8)))
      const mod  = { ...spell, damage: dmg }
      const origin = this.position.clone().setY(0.75)
      if (this.archetype === 'warlock') {
        // Warlocks fire double projectiles in a slight spread
        const left  = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 16)
        const right = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 16)
        return [
          new Projectile(origin.clone(), left, mod, scene),
          new Projectile(origin.clone(), right, mod, scene),
        ]
      }
      return [new Projectile(origin, base, mod, scene)]
    }

    // Boss: populate queue, drain sequentially
    if (this.bossQueue.length > 0) return []  // already draining

    if (this.phase === 1) {
      // Phase 1: single-target with boosted damage
      const spreadCount = 2
      const spreadAngle = Math.PI / 10
      const dmgMod = { ...spell, damage: Math.round(spell.damage * 1.3) }
      for (let i = 0; i < spreadCount; i++) {
        const offset = (i - Math.floor(spreadCount / 2)) * spreadAngle
        const dir    = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), offset)
        this.bossQueue.push({ spell: dmgMod, dir })
      }
    } else if (this.phase === 2) {
      // Phase 2: modified spells — triple bursts with wider spread
      const burstCount = 3
      const burstAngle = Math.PI / 6
      for (let b = 0; b < burstCount; b++) {
        const burstOffset = (b - 1) * burstAngle
        const burstDir = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), burstOffset)
        // Each burst fires 3 projectiles in a tight fan
        for (let i = -1; i <= 1; i++) {
          const dir = burstDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), i * (Math.PI / 20))
          this.bossQueue.push({ spell, dir })
        }
      }
    } else {
      // Phase 3: massive barrage
      const spreadCount = 9
      const spreadAngle = Math.PI / 12
      const dmgMod = { ...spell, damage: Math.round(spell.damage * 0.85) }
      for (let i = 0; i < spreadCount; i++) {
        const offset = (i - Math.floor(spreadCount / 2)) * spreadAngle
        const dir    = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), offset)
        this.bossQueue.push({ spell: dmgMod, dir })
      }
    }

    this.bossQueueTimer = 0
    return []
  }

  // ── Damage / death ────────────────────────────────────────────────────────

  takeDamage(amount: number, scene: THREE.Scene): void {
    this.hp -= amount
    if (this.hp <= 0 && !this.dying) this.startDying(scene)
  }

  private startDying(scene: THREE.Scene): void {
    this.dying     = true
    this.dyingTimer = 0
    this.clearTelegraph(scene)
    this.bossQueue  = []
  }
}
