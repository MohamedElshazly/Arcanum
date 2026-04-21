import * as THREE from 'three'
import { PLAYER_SPEED, PLAYER_RADIUS, MANA_REGEN_RATE } from '../constants'
import type { InputManager } from '../core/InputManager'
import type { RoomBounds }   from '../dungeon/Room'
import type { Obstacle }     from '../dungeon/Room'

const FLASK_CAST_TIME = 1.0
const DODGE_DURATION  = 0.2   // seconds of roll
const DODGE_DISTANCE  = 4.0   // units travelled during roll
const DODGE_COOLDOWN  = 1.5   // seconds between dodges

export class Player {
  readonly mesh: THREE.Mesh
  /** Alias for mesh.position — same object reference. */
  readonly position: THREE.Vector3

  hp      = 150
  maxHp   = 150
  mana    = 100
  maxMana = 100

  /** Last non-zero movement direction; used as fallback for spell targeting. */
  lastDirection = new THREE.Vector3(0, 0, 1)

  alive = true

  speedMultiplier   = 1.0
  knockbackVelocity = new THREE.Vector3()

  // Flask healing
  flasks         = 5
  maxFlasks      = 5
  flaskHealPercent = 0.5
  isHealing      = false
  healTimer      = 0

  // Dodge roll
  isDodging       = false
  dodgeTimer      = 0
  dodgeCooldownTimer = 0
  private dodgeDir = new THREE.Vector3()

  constructor() {
    const geo  = new THREE.CylinderGeometry(PLAYER_RADIUS, PLAYER_RADIUS, 1.5, 16)
    const mat  = new THREE.MeshStandardMaterial({
      color:   0xffffff,
      emissive: new THREE.Color(0x222222),
    })
    this.mesh  = new THREE.Mesh(geo, mat)
    this.mesh.position.set(0, 0.75, 0)
    this.position = this.mesh.position
  }

  update(
    delta: number,
    input: InputManager,
    bounds: RoomBounds,
    cameraAngle  = 0,
    obstacles: readonly Obstacle[] = [],
  ): void {
    // Dodge cooldown ticks always
    if (this.dodgeCooldownTimer > 0) this.dodgeCooldownTimer -= delta

    // Dodge roll in progress — move along dodgeDir, skip normal input
    if (this.isDodging) {
      this.dodgeTimer -= delta
      const speed = DODGE_DISTANCE / DODGE_DURATION
      this.position.x += this.dodgeDir.x * speed * delta
      this.position.z += this.dodgeDir.z * speed * delta

      if (this.dodgeTimer <= 0) {
        this.isDodging = false
        this.dodgeTimer = 0
        // Restore normal appearance
        const mat = this.mesh.material as THREE.MeshStandardMaterial
        mat.opacity = 1
        mat.transparent = false
      }

      // Still clamp bounds and obstacles during dodge
      this.position.x = Math.max(bounds.minX + PLAYER_RADIUS, Math.min(bounds.maxX - PLAYER_RADIUS, this.position.x))
      this.position.z = Math.max(bounds.minZ + PLAYER_RADIUS, Math.min(bounds.maxZ - PLAYER_RADIUS, this.position.z))
      for (const obs of obstacles) {
        const dx   = this.position.x - obs.x
        const dz   = this.position.z - obs.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        const min  = obs.r + PLAYER_RADIUS
        if (dist > 0 && dist < min) {
          const push = (min - dist) / dist
          this.position.x += dx * push
          this.position.z += dz * push
        }
      }
      return
    }

    // Flask heal timer
    if (this.isHealing) {
      this.healTimer -= delta
      if (this.healTimer <= 0) {
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.flaskHealPercent)
        this.isHealing = false
        this.healTimer = 0
        // Remove green tint
        const mat = this.mesh.material as THREE.MeshStandardMaterial
        mat.emissive.set(0x222222)
      }
      return  // Cannot move or act while healing
    }

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

    // Obstacle push-out
    for (const obs of obstacles) {
      const dx   = this.position.x - obs.x
      const dz   = this.position.z - obs.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      const min  = obs.r + PLAYER_RADIUS
      if (dist > 0 && dist < min) {
        const push = (min - dist) / dist
        this.position.x += dx * push
        this.position.z += dz * push
      }
    }

    this.mana = Math.min(this.maxMana, this.mana  + MANA_REGEN_RATE * delta)
  }

  takeDamage(amount: number): void {
    if (import.meta.env.DEV) return
    if (this.isDodging) return  // i-frames during dodge
    this.hp = Math.max(0, this.hp - amount)
  }

  startDodge(cameraAngle: number, input: InputManager): boolean {
    if (this.isDodging || this.isHealing || this.dodgeCooldownTimer > 0) return false

    // Roll in input direction, or lastDirection if standing still
    const dir = new THREE.Vector3()
    if (input.isHeld('ArrowLeft'))  dir.x -= 1
    if (input.isHeld('ArrowRight')) dir.x += 1
    if (input.isHeld('ArrowUp'))    dir.z -= 1
    if (input.isHeld('ArrowDown'))  dir.z += 1

    if (dir.lengthSq() > 0) {
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle)
      dir.normalize()
    } else {
      dir.copy(this.lastDirection)
    }

    this.dodgeDir.copy(dir)
    this.isDodging = true
    this.dodgeTimer = DODGE_DURATION
    this.dodgeCooldownTimer = DODGE_COOLDOWN

    // Ghost effect during dodge
    const mat = this.mesh.material as THREE.MeshStandardMaterial
    mat.transparent = true
    mat.opacity = 0.4

    return true
  }

  useFlask(): boolean {
    if (this.flasks <= 0 || this.isHealing || this.hp >= this.maxHp || this.hp <= 0) return false
    this.flasks -= 1
    this.isHealing = true
    this.healTimer = FLASK_CAST_TIME
    // Green tint during heal
    const mat = this.mesh.material as THREE.MeshStandardMaterial
    mat.emissive.set(0x003300)
    return true
  }

  addFlask(): boolean {
    if (this.flasks >= this.maxFlasks) return false
    this.flasks += 1
    return true
  }
}
