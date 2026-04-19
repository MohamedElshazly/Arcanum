import * as THREE from 'three'
import { PLAYER_SPEED, PLAYER_RADIUS, MANA_REGEN_RATE } from '../constants'
import type { InputManager } from '../core/InputManager'
import type { RoomBounds }   from '../dungeon/Room'

export class Player {
  readonly mesh: THREE.Mesh
  /** Alias for mesh.position — same object reference. */
  readonly position: THREE.Vector3

  hp      = 100
  maxHp   = 100
  mana    = 100
  maxMana = 100

  /** Last non-zero movement direction; used as fallback for spell targeting. */
  lastDirection = new THREE.Vector3(0, 0, 1)

  alive = true

  speedMultiplier   = 1.0
  knockbackVelocity = new THREE.Vector3()

  constructor() {
    const geo  = new THREE.CylinderGeometry(PLAYER_RADIUS, PLAYER_RADIUS, 1.5, 16)
    const mat  = new THREE.MeshStandardMaterial({ color: 0xffffff })
    this.mesh  = new THREE.Mesh(geo, mat)
    this.mesh.position.set(0, 0.75, 0)
    this.position = this.mesh.position
  }

  update(delta: number, input: InputManager, bounds: RoomBounds, cameraAngle = 0): void {
    this.speedMultiplier = 1.0

    const dir = new THREE.Vector3()
    if (input.isHeld('ArrowLeft'))  dir.x -= 1
    if (input.isHeld('ArrowRight')) dir.x += 1
    if (input.isHeld('ArrowUp'))    dir.z -= 1
    if (input.isHeld('ArrowDown'))  dir.z += 1

    if (dir.lengthSq() > 0) {
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle)
      dir.normalize()
      this.lastDirection.copy(dir)
      this.position.x += dir.x * PLAYER_SPEED * this.speedMultiplier * delta
      this.position.z += dir.z * PLAYER_SPEED * this.speedMultiplier * delta
    }

    if (this.knockbackVelocity.lengthSq() > 0.001) {
      this.position.x += this.knockbackVelocity.x * delta
      this.position.z += this.knockbackVelocity.z * delta
      this.knockbackVelocity.multiplyScalar(Math.max(0, 1 - 8 * delta))
    }

    this.position.x = Math.max(bounds.minX + PLAYER_RADIUS, Math.min(bounds.maxX - PLAYER_RADIUS, this.position.x))
    this.position.z = Math.max(bounds.minZ + PLAYER_RADIUS, Math.min(bounds.maxZ - PLAYER_RADIUS, this.position.z))

    this.mana = Math.min(this.maxMana, this.mana + MANA_REGEN_RATE * delta)
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount)
  }
}
