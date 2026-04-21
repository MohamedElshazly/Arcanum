import * as THREE  from 'three'
import type { Enemy } from '../entities/Enemy'
import { SPELLS } from './SpellDefinitions'
import type { StatusEffect } from './SpellDefinitions'

// ── Shared interface for time-tracked effects ──────────────────────────────

export interface IEffect {
  alive: boolean
  update(delta: number, scene: THREE.Scene, enemies: Enemy[]): void
  dispose(scene: THREE.Scene): void
}

// ── Blink — instant self teleport ─────────────────────────────────────────

export function castBlink(
  position:      THREE.Vector3,
  mesh:          THREE.Mesh,
  lastDirection: THREE.Vector3,
): void {
  position.x += lastDirection.x * 5
  position.z += lastDirection.z * 5
  mesh.position.copy(position)

  const mat = mesh.material as THREE.MeshStandardMaterial
  const savedEmissive    = mat.emissive.clone()
  const savedIntensity   = mat.emissiveIntensity
  mat.emissive.set(0xffffff)
  mat.emissiveIntensity = 1
  setTimeout(() => {
    mat.emissive.copy(savedEmissive)
    mat.emissiveIntensity = savedIntensity
  }, 100)
}

// ── Frozen Nova ────────────────────────────────────────────────────────────

export class FrozenNovaEffect implements IEffect {
  alive = true
  private ring:          THREE.Mesh
  private timer          = 0
  private damageApplied  = false
  private readonly expandDuration = 0.3
  private readonly totalDuration  = 0.5
  private readonly maxRadius:     number

  constructor(
    private readonly center:       THREE.Vector3,
    private readonly enemies:      Enemy[],
    private readonly damage:       number,
    scene: THREE.Scene,
    private readonly statusEffect?: StatusEffect,
  ) {
    this.maxRadius = SPELLS.frozen_nova.radius ?? 5
    const geo = new THREE.TorusGeometry(this.maxRadius, 0.2, 8, 32)
    const mat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color('#aaddff'),
      emissive:          new THREE.Color('#00ccff'),
      emissiveIntensity: 2.0,
      transparent:       true,
      opacity:           0.8,
    })
    this.ring = new THREE.Mesh(geo, mat)
    this.ring.position.set(center.x, 0.5, center.z)
    this.ring.rotation.x = -Math.PI / 2
    this.ring.scale.set(0.01, 0.01, 1)
    scene.add(this.ring)
  }

  update(delta: number, scene: THREE.Scene, _enemies: Enemy[]): void {
    this.timer += delta
    const progress = Math.min(this.timer / this.expandDuration, 1)
    this.ring.scale.set(progress, progress, 1)

    if (!this.damageApplied && progress >= 1) {
      this.applyDamage(scene)
      this.damageApplied = true
    }

    if (this.timer > this.expandDuration) {
      const fade = 1 - (this.timer - this.expandDuration) / (this.totalDuration - this.expandDuration)
      ;(this.ring.material as THREE.MeshStandardMaterial).opacity = 0.8 * Math.max(0, fade)
    }

    if (this.timer >= this.totalDuration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  private applyDamage(scene: THREE.Scene): void {
    const r2 = this.maxRadius * this.maxRadius
    for (const e of this.enemies) {
      if (!e.alive) continue
      const dx = e.position.x - this.center.x
      const dz = e.position.z - this.center.z
      if (dx * dx + dz * dz <= r2) {
        e.takeDamage(this.damage, scene)
        if (this.statusEffect) e.applyStatusEffect(this.statusEffect)
      }
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.ring)
    this.ring.geometry.dispose()
    ;(this.ring.material as THREE.MeshStandardMaterial).dispose()
  }
}

// ── Ice Wall ───────────────────────────────────────────────────────────────

export class IceWallEffect implements IEffect {
  alive = true
  private walls:  THREE.Mesh[] = []
  private timer   = 0
  private readonly duration  = 4.0
  private readonly fadeStart = 3.5

  constructor(
    position:  THREE.Vector3,
    direction: THREE.Vector3,
    scene:     THREE.Scene,
  ) {
    const perp    = new THREE.Vector3(-direction.z, 0, direction.x)
    const offsets = [-1.2, 0, 1.2]
    for (const offset of offsets) {
      const geo = new THREE.BoxGeometry(0.6, 2.5, 0.3)
      const mat = new THREE.MeshStandardMaterial({
        color:             new THREE.Color('#aaddff'),
        emissive:          new THREE.Color('#00ffff'),
        emissiveIntensity: 0.5,
        transparent:       true,
        opacity:           0.85,
      })
      const wall = new THREE.Mesh(geo, mat)
      wall.position
        .copy(position)
        .addScaledVector(direction, 1.5)
        .addScaledVector(perp, offset)
      wall.position.y = 1.25
      wall.lookAt(wall.position.clone().addScaledVector(perp, 1))
      scene.add(wall)
      this.walls.push(wall)
    }
  }

  update(delta: number, scene: THREE.Scene, _enemies: Enemy[]): void {
    this.timer += delta
    if (this.timer >= this.fadeStart) {
      const fade = 1 - (this.timer - this.fadeStart) / (this.duration - this.fadeStart)
      for (const w of this.walls) {
        ;(w.material as THREE.MeshStandardMaterial).opacity = 0.85 * Math.max(0, fade)
      }
    }
    if (this.timer >= this.duration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  dispose(scene: THREE.Scene): void {
    for (const w of this.walls) {
      scene.remove(w)
      w.geometry.dispose()
      ;(w.material as THREE.MeshStandardMaterial).dispose()
    }
    this.walls = []
  }
}

// ── Thunder Clap — instant AOE with brief ring visual ─────────────────────

export class ThunderClapEffect implements IEffect {
  alive = true
  private ring:  THREE.Mesh
  private timer  = 0
  private readonly duration = 0.35

  constructor(
    position: THREE.Vector3,
    enemies:  Enemy[],
    damage:   number,
    radius:   number,
    scene:    THREE.Scene,
    statusEffect?: StatusEffect,
  ) {
    const r2 = radius * radius
    for (const e of enemies) {
      if (!e.alive) continue
      const dx = e.position.x - position.x
      const dz = e.position.z - position.z
      if (dx * dx + dz * dz <= r2) {
        e.takeDamage(damage, scene)
        if (statusEffect) e.applyStatusEffect(statusEffect)
      }
    }

    const geo = new THREE.TorusGeometry(radius * 0.9, 0.15, 8, 32)
    const mat = new THREE.MeshStandardMaterial({
      color:             0xffffff,
      emissive:          new THREE.Color(0xffffff),
      emissiveIntensity: 2.0,
      transparent:       true,
      opacity:           0.9,
    })
    this.ring = new THREE.Mesh(geo, mat)
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.set(position.x, 0.3, position.z)
    scene.add(this.ring)
  }

  update(delta: number, scene: THREE.Scene, _enemies: Enemy[]): void {
    this.timer += delta
    ;(this.ring.material as THREE.MeshStandardMaterial).opacity =
      0.9 * Math.max(0, 1 - this.timer / this.duration)
    if (this.timer >= this.duration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.ring)
    this.ring.geometry.dispose()
    ;(this.ring.material as THREE.MeshStandardMaterial).dispose()
  }
}

// ── Arcane Explosion — instant large AOE ──────────────────────────────────

export class ArcaneExplosionEffect implements IEffect {
  alive = true
  private ring:  THREE.Mesh
  private timer  = 0
  private readonly duration = 0.4

  constructor(
    position: THREE.Vector3,
    enemies:  Enemy[],
    damage:   number,
    radius:   number,
    scene:    THREE.Scene,
  ) {
    const r2 = radius * radius
    for (const e of enemies) {
      if (!e.alive) continue
      const dx = e.position.x - position.x
      const dz = e.position.z - position.z
      if (dx * dx + dz * dz <= r2) e.takeDamage(damage, scene)
    }

    const geo = new THREE.TorusGeometry(radius * 0.9, 0.2, 8, 32)
    const mat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color('#dd88ff'),
      emissive:          new THREE.Color('#aa00ff'),
      emissiveIntensity: 2.0,
      transparent:       true,
      opacity:           0.85,
    })
    this.ring = new THREE.Mesh(geo, mat)
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.set(position.x, 0.3, position.z)
    scene.add(this.ring)
  }

  update(delta: number, scene: THREE.Scene, _enemies: Enemy[]): void {
    this.timer += delta
    ;(this.ring.material as THREE.MeshStandardMaterial).opacity =
      0.85 * Math.max(0, 1 - this.timer / this.duration)
    if (this.timer >= this.duration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.ring)
    this.ring.geometry.dispose()
    ;(this.ring.material as THREE.MeshStandardMaterial).dispose()
  }
}

// ── Static Field — persistent zapping zone ────────────────────────────────

export class StaticFieldEffect implements IEffect {
  alive = true
  private zone:        THREE.Mesh
  private totalTimer   = 0
  private tickTimer    = 0
  private readonly duration     = SPELLS.static_field.duration ?? 5
  private readonly tickInterval = 0.5
  private readonly radius       = SPELLS.static_field.radius ?? 4
  private readonly damage       = SPELLS.static_field.damage

  constructor(
    position: THREE.Vector3,
    scene:    THREE.Scene,
  ) {
    const geo = new THREE.CylinderGeometry(this.radius, this.radius, 0.1, 24)
    const mat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color(SPELLS.static_field.color),
      emissive:          new THREE.Color(SPELLS.static_field.emissiveColor),
      emissiveIntensity: SPELLS.static_field.emissiveIntensity,
      transparent:       true,
      opacity:           0.35,
    })
    this.zone = new THREE.Mesh(geo, mat)
    this.zone.position.set(position.x, 0.05, position.z)
    scene.add(this.zone)
  }

  update(delta: number, scene: THREE.Scene, enemies: Enemy[]): void {
    this.totalTimer += delta
    this.tickTimer  += delta

    const pulse = 1 + Math.sin(this.totalTimer * 8) * 0.3
    ;(this.zone.material as THREE.MeshStandardMaterial).emissiveIntensity =
      SPELLS.static_field.emissiveIntensity * pulse

    if (this.tickTimer >= this.tickInterval) {
      this.tickTimer -= this.tickInterval
      this.zapEnemies(enemies, scene)
    }

    if (this.totalTimer >= this.duration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  private zapEnemies(enemies: Enemy[], scene: THREE.Scene): void {
    const r2 = this.radius * this.radius
    const center = this.zone.position
    for (const e of enemies) {
      if (!e.alive) continue
      const dx = e.position.x - center.x
      const dz = e.position.z - center.z
      if (dx * dx + dz * dz <= r2) {
        e.takeDamage(this.damage, scene)
        scene.add(this.makeBolt(center, e.position))
      }
    }
  }

  private makeBolt(from: THREE.Vector3, to: THREE.Vector3): THREE.Line {
    const points = [from.clone().setY(0.5), to.clone().setY(0.75)]
    const geo    = new THREE.BufferGeometry().setFromPoints(points)
    const mat    = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8 })
    const line   = new THREE.Line(geo, mat)
    setTimeout(() => {
      line.parent?.remove(line)
      geo.dispose()
      mat.dispose()
    }, 150)
    return line
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.zone)
    this.zone.geometry.dispose()
    ;(this.zone.material as THREE.MeshStandardMaterial).dispose()
  }
}

// ── Lightning Bolt — brief glowing line for chain-lightning jumps ──────────

export class LightningBoltEffect implements IEffect {
  alive = true
  private line:  THREE.Line
  private timer  = 0
  private readonly duration = 0.2

  constructor(from: THREE.Vector3, to: THREE.Vector3, scene: THREE.Scene) {
    const points = [from.clone().setY(0.75), to.clone().setY(0.75)]
    const geo    = new THREE.BufferGeometry().setFromPoints(points)
    const mat    = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 1.0 })
    this.line    = new THREE.Line(geo, mat)
    scene.add(this.line)
  }

  update(delta: number, scene: THREE.Scene, _enemies: Enemy[]): void {
    this.timer += delta
    ;(this.line.material as THREE.LineBasicMaterial).opacity =
      Math.max(0, 1 - this.timer / this.duration)
    if (this.timer >= this.duration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.line)
    this.line.geometry.dispose()
    ;(this.line.material as THREE.LineBasicMaterial).dispose()
  }
}

// ── Frost Decal — ice impact mark on the floor ────────────────────────────

export class FrostDecalEffect implements IEffect {
  alive = true
  private mesh:  THREE.Mesh
  private timer  = 0
  private readonly duration = 2.0

  constructor(position: THREE.Vector3, scene: THREE.Scene) {
    const geo = new THREE.CircleGeometry(0.8, 12)
    const mat = new THREE.MeshBasicMaterial({
      color:       0xaaddff,
      transparent: true,
      opacity:     0.5,
      side:        THREE.DoubleSide,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.position.set(position.x, 0.01, position.z)
    scene.add(this.mesh)
  }

  update(delta: number, scene: THREE.Scene, _enemies: Enemy[]): void {
    this.timer += delta
    ;(this.mesh.material as THREE.MeshBasicMaterial).opacity =
      0.5 * Math.max(0, 1 - this.timer / this.duration)
    if (this.timer >= this.duration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.MeshBasicMaterial).dispose()
  }
}

// ── Burning Hands — cone AOE in facing direction ─────────────────────────

export class BurningHandsEffect implements IEffect {
  alive = true
  private cone: THREE.Mesh
  private timer = 0
  private readonly duration = 0.4
  private damageApplied = false

  constructor(
    private readonly center: THREE.Vector3,
    private readonly direction: THREE.Vector3,
    private readonly enemies: Enemy[],
    private readonly damage: number,
    private readonly radius: number,
    private readonly statusEffect: StatusEffect | undefined,
    scene: THREE.Scene,
  ) {
    const geo = new THREE.ConeGeometry(radius * 0.6, radius, 8, 1, true)
    const mat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color('#ff6600'),
      emissive:          new THREE.Color('#ff4400'),
      emissiveIntensity: 2.0,
      transparent:       true,
      opacity:           0.6,
      side:              THREE.DoubleSide,
    })
    this.cone = new THREE.Mesh(geo, mat)
    this.cone.position.copy(center)
    this.cone.position.y = 0.5
    const up = new THREE.Vector3(0, 1, 0)
    const forward = direction.clone().normalize()
    this.cone.quaternion.setFromUnitVectors(up, forward)
    this.cone.position.addScaledVector(forward, radius * 0.5)
    scene.add(this.cone)
  }

  update(delta: number, scene: THREE.Scene, _enemies: Enemy[]): void {
    this.timer += delta
    if (!this.damageApplied) {
      this.applyDamage(scene)
      this.damageApplied = true
    }
    const fade = 1 - this.timer / this.duration
    ;(this.cone.material as THREE.MeshStandardMaterial).opacity = 0.6 * Math.max(0, fade)
    if (this.timer >= this.duration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  private applyDamage(scene: THREE.Scene): void {
    const r2 = this.radius * this.radius
    for (const e of this.enemies) {
      if (!e.alive) continue
      const dx = e.position.x - this.center.x
      const dz = e.position.z - this.center.z
      const distSq = dx * dx + dz * dz
      if (distSq > r2) continue
      const dist = Math.sqrt(distSq)
      if (dist < 0.01) {
        e.takeDamage(this.damage, scene)
        if (this.statusEffect) e.applyStatusEffect(this.statusEffect)
        continue
      }
      const dot = (dx * this.direction.x + dz * this.direction.z) / dist
      if (dot > 0.5) {
        e.takeDamage(this.damage, scene)
        if (this.statusEffect) e.applyStatusEffect(this.statusEffect)
      }
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.cone)
    this.cone.geometry.dispose()
    ;(this.cone.material as THREE.MeshStandardMaterial).dispose()
  }
}

// ── Cone of Cold — wider cone, freeze ────────────────────────────────────

export class ConeOfColdEffect implements IEffect {
  alive = true
  private cone: THREE.Mesh
  private timer = 0
  private readonly duration = 0.5
  private damageApplied = false

  constructor(
    private readonly center: THREE.Vector3,
    private readonly direction: THREE.Vector3,
    private readonly enemies: Enemy[],
    private readonly damage: number,
    private readonly radius: number,
    private readonly statusEffect: StatusEffect | undefined,
    scene: THREE.Scene,
  ) {
    const geo = new THREE.ConeGeometry(radius * 0.6, radius, 8, 1, true)
    const mat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color('#aaddff'),
      emissive:          new THREE.Color('#00ccff'),
      emissiveIntensity: 2.0,
      transparent:       true,
      opacity:           0.6,
      side:              THREE.DoubleSide,
    })
    this.cone = new THREE.Mesh(geo, mat)
    this.cone.position.copy(center)
    this.cone.position.y = 0.5
    const up = new THREE.Vector3(0, 1, 0)
    const forward = direction.clone().normalize()
    this.cone.quaternion.setFromUnitVectors(up, forward)
    this.cone.position.addScaledVector(forward, radius * 0.5)
    scene.add(this.cone)
  }

  update(delta: number, scene: THREE.Scene, _enemies: Enemy[]): void {
    this.timer += delta
    if (!this.damageApplied) {
      this.applyDamage(scene)
      this.damageApplied = true
    }
    const fade = 1 - this.timer / this.duration
    ;(this.cone.material as THREE.MeshStandardMaterial).opacity = 0.6 * Math.max(0, fade)
    if (this.timer >= this.duration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  private applyDamage(scene: THREE.Scene): void {
    const r2 = this.radius * this.radius
    for (const e of this.enemies) {
      if (!e.alive) continue
      const dx = e.position.x - this.center.x
      const dz = e.position.z - this.center.z
      const distSq = dx * dx + dz * dz
      if (distSq > r2) continue
      const dist = Math.sqrt(distSq)
      if (dist < 0.01) {
        e.takeDamage(this.damage, scene)
        if (this.statusEffect) e.applyStatusEffect(this.statusEffect)
        continue
      }
      const dot = (dx * this.direction.x + dz * this.direction.z) / dist
      if (dot > 0) {  // 90-degree arc
        e.takeDamage(this.damage, scene)
        if (this.statusEffect) e.applyStatusEffect(this.statusEffect)
      }
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.cone)
    this.cone.geometry.dispose()
    ;(this.cone.material as THREE.MeshStandardMaterial).dispose()
  }
}

// ── Thunderwave — self-centered AOE with knockback ───────────────────────

export class ThunderwaveEffect implements IEffect {
  alive = true
  private ring: THREE.Mesh
  private timer = 0
  private readonly duration = 0.4

  constructor(
    position: THREE.Vector3,
    enemies:  Enemy[],
    damage:   number,
    radius:   number,
    statusEffect: StatusEffect | undefined,
    scene:    THREE.Scene,
  ) {
    const r2 = radius * radius
    for (const e of enemies) {
      if (!e.alive) continue
      const dx = e.position.x - position.x
      const dz = e.position.z - position.z
      if (dx * dx + dz * dz <= r2) {
        e.takeDamage(damage, scene)
        if (statusEffect) e.applyStatusEffect(statusEffect)
      }
    }

    const geo = new THREE.TorusGeometry(radius * 0.9, 0.2, 8, 32)
    const mat = new THREE.MeshStandardMaterial({
      color:             0xffffff,
      emissive:          new THREE.Color(0xffff88),
      emissiveIntensity: 2.0,
      transparent:       true,
      opacity:           0.9,
    })
    this.ring = new THREE.Mesh(geo, mat)
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.set(position.x, 0.3, position.z)
    scene.add(this.ring)
  }

  update(delta: number, scene: THREE.Scene, _enemies: Enemy[]): void {
    this.timer += delta
    ;(this.ring.material as THREE.MeshStandardMaterial).opacity =
      0.9 * Math.max(0, 1 - this.timer / this.duration)
    if (this.timer >= this.duration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.ring)
    this.ring.geometry.dispose()
    ;(this.ring.material as THREE.MeshStandardMaterial).dispose()
  }
}

// ── Force Wall — wall of arcane energy at mouse position ─────────────────

export class ForceWallEffect implements IEffect {
  alive = true
  private walls: THREE.Mesh[] = []
  private timer = 0
  private readonly duration: number
  private readonly fadeStart: number
  private readonly damage: number
  private readonly hitEnemies = new Set<Enemy>()

  constructor(
    position:  THREE.Vector3,
    direction: THREE.Vector3,
    damage:    number,
    duration:  number,
    scene:     THREE.Scene,
  ) {
    this.damage = damage
    this.duration = duration
    this.fadeStart = duration - 0.5

    const perp = new THREE.Vector3(-direction.z, 0, direction.x)
    const offsets = [-1.2, 0, 1.2]
    for (const offset of offsets) {
      const geo = new THREE.BoxGeometry(0.6, 2.5, 0.3)
      const mat = new THREE.MeshStandardMaterial({
        color:             new THREE.Color('#dd88ff'),
        emissive:          new THREE.Color('#aa00ff'),
        emissiveIntensity: 1.5,
        transparent:       true,
        opacity:           0.7,
      })
      const wall = new THREE.Mesh(geo, mat)
      wall.position.copy(position).addScaledVector(perp, offset)
      wall.position.y = 1.25
      wall.lookAt(wall.position.clone().addScaledVector(perp, 1))
      scene.add(wall)
      this.walls.push(wall)
    }
  }

  update(delta: number, scene: THREE.Scene, enemies: Enemy[]): void {
    this.timer += delta

    for (const e of enemies) {
      if (!e.alive || this.hitEnemies.has(e)) continue
      for (const w of this.walls) {
        const dx = e.position.x - w.position.x
        const dz = e.position.z - w.position.z
        if (Math.abs(dx) < 0.8 && Math.abs(dz) < 0.8) {
          e.takeDamage(this.damage, scene)
          this.hitEnemies.add(e)
          break
        }
      }
    }

    if (this.timer >= this.fadeStart) {
      const fade = 1 - (this.timer - this.fadeStart) / (this.duration - this.fadeStart)
      for (const w of this.walls) {
        ;(w.material as THREE.MeshStandardMaterial).opacity = 0.7 * Math.max(0, fade)
      }
    }
    if (this.timer >= this.duration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  dispose(scene: THREE.Scene): void {
    for (const w of this.walls) {
      scene.remove(w)
      w.geometry.dispose()
      ;(w.material as THREE.MeshStandardMaterial).dispose()
    }
    this.walls = []
  }
}
