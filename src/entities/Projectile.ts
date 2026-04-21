import * as THREE         from 'three'
import { Spell }          from '../spells/SpellDefinitions'
import { TrailSystem }    from '../fx/TrailSystem'
import type { RoomBounds, Obstacle } from '../dungeon/Room'
import { isOutOfBounds }  from '../utils/CollisionUtils'

export class Projectile {
  readonly mesh:  THREE.Mesh
  readonly light: THREE.PointLight
  readonly spell: Spell
  readonly velocity: THREE.Vector3
  readonly origin:   THREE.Vector3
  readonly damage:   number
  alive = true

  /** Set by Game.ts each frame for 'arcane_missile' to steer toward. */
  homingTarget?: THREE.Vector3

  /** Non-zero only for 'chain_lightning'; decremented on each jump. */
  jumpsRemaining: number

  /** For piercing projectiles: tracks enemies already hit to avoid double-damage. */
  private readonly hitEnemies = new Set<object>()

  /** For aura projectiles (ball_lightning): ticks up to auraTick interval. */
  auraTimer = 0

  private trail:       TrailSystem
  private elapsedTime = 0

  constructor(
    origin:         THREE.Vector3,
    direction:      THREE.Vector3,
    spell:          Spell,
    scene:          THREE.Scene,
    jumpsRemaining  = 0,
  ) {
    this.origin         = origin.clone()
    this.spell          = spell
    this.damage         = spell.damage
    this.jumpsRemaining = jumpsRemaining
    this.velocity = direction.clone().normalize().multiplyScalar(spell.speed ?? 10)

    const geo = this.buildGeometry(spell)
    const mat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color(spell.color),
      emissive:          new THREE.Color(spell.emissiveColor),
      emissiveIntensity: spell.emissiveIntensity,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.scale.set(spell.projectileScale.x, spell.projectileScale.y, spell.projectileScale.z)
    this.mesh.position.copy(origin)

    // Align cone/cylinder/spike along the travel direction
    if (['cone', 'cylinder', 'spike'].includes(spell.projectileGeometry)) {
      const up  = new THREE.Vector3(0, 1, 0)
      const vel = direction.clone().normalize()
      if (Math.abs(up.dot(vel)) < 0.99) {
        this.mesh.quaternion.setFromUnitVectors(up, vel)
      }
    }

    this.light = new THREE.PointLight(
      new THREE.Color(spell.emissiveColor),
      spell.emissiveIntensity * 2,
      8,
    )
    this.light.position.copy(origin)

    scene.add(this.mesh)
    scene.add(this.light)
    this.trail = new TrailSystem(spell.color, scene)
  }

  update(delta: number, bounds: RoomBounds, scene: THREE.Scene, obstacles: readonly Obstacle[] = []): void {
    if (!this.alive) return
    this.elapsedTime += delta

    // ── Homing: arcane_missile steers toward homingTarget ──────────────────
    if (this.spell.id === 'arcane_missile' && this.homingTarget) {
      const speed = this.velocity.length()
      const toTarget = new THREE.Vector3()
        .subVectors(this.homingTarget, this.mesh.position)
        .setY(0)
        .normalize()
        .multiplyScalar(speed)
      this.velocity.lerp(toTarget, 2.5 * delta)
      const currentSpeed = this.velocity.length()
      if (currentSpeed > 0) this.velocity.multiplyScalar(speed / currentSpeed)
    }

    // ── Movement ────────────────────────────────────────────────────────────
    this.mesh.position.x += this.velocity.x * delta
    this.mesh.position.z += this.velocity.z * delta
    this.light.position.copy(this.mesh.position)

    // ── Element-specific visuals ─────────────────────────────────────────────
    if (this.spell.element === 'fire') {
      const wobble = 1 + Math.sin(this.elapsedTime * 15) * 0.05
      this.mesh.scale.set(
        this.spell.projectileScale.x * wobble,
        this.spell.projectileScale.y * wobble,
        this.spell.projectileScale.z * wobble,
      )
    } else if (this.spell.element === 'lightning') {
      this.mesh.rotation.y += delta * 12
    } else if (this.spell.element === 'arcane') {
      this.mesh.rotation.y += delta * 2
    }

    this.trail.update(this.mesh.position)

    // ── Obstacle collision ─────────────────────────────────────────────────
    const projRadius = Math.max(this.spell.projectileScale.x, this.spell.projectileScale.z) * 0.25
    for (const obs of obstacles) {
      const dx = this.mesh.position.x - obs.x
      const dz = this.mesh.position.z - obs.z
      if (dx * dx + dz * dz < (obs.r + projRadius) * (obs.r + projRadius)) {
        this.destroy(scene)
        return
      }
    }

    // ── Range / bounds check ────────────────────────────────────────────────
    const travelled = this.mesh.position.distanceTo(this.origin)
    if (
      travelled > this.spell.range ||
      isOutOfBounds(this.mesh.position.x, this.mesh.position.z, bounds)
    ) {
      this.destroy(scene)
    }
  }

  /** Returns the set of enemies already hit by this piercing projectile. */
  get piercingHitSet(): Set<object> { return this.hitEnemies }

  destroy(scene: THREE.Scene): void {
    if (!this.alive) return
    this.alive = false
    scene.remove(this.mesh)
    scene.remove(this.light)
    this.trail.dispose(scene)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.MeshStandardMaterial).dispose()
  }

  private buildGeometry(spell: Spell): THREE.BufferGeometry {
    switch (spell.projectileGeometry) {
      case 'sphere':   return new THREE.SphereGeometry(0.5, 8, 6)
      case 'cone':     return new THREE.ConeGeometry(0.5, 1, 8)
      case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 8)
      case 'ring':     return new THREE.TorusGeometry(0.5, 0.1, 8, 16)
      case 'spike':    return new THREE.ConeGeometry(0.1, 1, 6)
      default:         return new THREE.SphereGeometry(0.5, 8, 6)
    }
  }
}
