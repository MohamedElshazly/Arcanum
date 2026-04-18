import * as THREE from 'three'
import { ENEMY_SPEED } from '../constants'

export class Enemy {
  readonly mesh: THREE.Mesh
  /** Alias for mesh.position — same object reference. */
  readonly position: THREE.Vector3

  hp:    number
  maxHp: number
  alive = true

  constructor(x: number, z: number, hp = 40) {
    this.hp    = hp
    this.maxHp = hp

    const geo  = new THREE.BoxGeometry(0.8, 1.2, 0.8)
    const mat  = new THREE.MeshStandardMaterial({ color: 0xff2222 })
    this.mesh  = new THREE.Mesh(geo, mat)
    this.mesh.position.set(x, 0.6, z)
    this.position = this.mesh.position
  }

  update(delta: number, playerPosition: THREE.Vector3): void {
    if (!this.alive) return

    const dir  = new THREE.Vector3().subVectors(playerPosition, this.position).setY(0)
    const dist = dir.length()
    if (dist > 0.5) {
      dir.normalize()
      this.position.x += dir.x * ENEMY_SPEED * delta
      this.position.z += dir.z * ENEMY_SPEED * delta
    }
  }

  takeDamage(amount: number, scene: THREE.Scene): void {
    this.hp -= amount
    if (this.hp <= 0) this.die(scene)
  }

  private die(scene: THREE.Scene): void {
    this.alive = false
    scene.remove(this.mesh)
  }
}
