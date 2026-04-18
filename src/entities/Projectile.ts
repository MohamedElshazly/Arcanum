import * as THREE from 'three'
import { FIREBALL_RADIUS } from '../constants'
import type { RoomBounds } from '../dungeon/Room'
import { isOutOfBounds } from '../utils/CollisionUtils'

export class Projectile {
  readonly mesh: THREE.Mesh
  readonly velocity: THREE.Vector3
  readonly origin: THREE.Vector3
  readonly range: number
  readonly damage: number
  alive = true

  constructor(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number,
    range: number,
    damage: number,
  ) {
    this.origin = origin.clone()
    this.range = range
    this.damage = damage
    this.velocity = direction.clone().normalize().multiplyScalar(speed)

    const geo = new THREE.SphereGeometry(FIREBALL_RADIUS, 8, 8)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: new THREE.Color(0xff4400),
      emissiveIntensity: 1,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.copy(origin)
  }

  update(delta: number, bounds: RoomBounds, scene: THREE.Scene): void {
    if (!this.alive) return

    this.mesh.position.x += this.velocity.x * delta
    this.mesh.position.z += this.velocity.z * delta

    const travelled = this.mesh.position.distanceTo(this.origin)
    if (travelled > this.range || isOutOfBounds(this.mesh.position.x, this.mesh.position.z, bounds)) {
      this.destroy(scene)
    }
  }

  destroy(scene: THREE.Scene): void {
    if (!this.alive) return
    this.alive = false
    scene.remove(this.mesh)
  }
}
