import * as THREE from 'three'
import { PLAYER_SPEED, PLAYER_RADIUS, MANA_REGEN_RATE } from '../constants'
import type { InputManager } from '../core/InputManager'
import type { RoomBounds }   from '../dungeon/Room'
import type { Obstacle }     from '../dungeon/Room'
import { buildWizardModel, disposeWizardModel } from '../visuals/WizardModel'
import type { WizardModel } from '../visuals/WizardModel'

const FLASK_CAST_TIME = 1.0
const DODGE_DURATION  = 0.2   // seconds of roll
const DODGE_DISTANCE  = 4.0   // units travelled during roll
const DODGE_COOLDOWN  = 1.5   // seconds between dodges

export class Player {
  readonly mesh: THREE.Group
  /** Alias for mesh.position — same object reference. */
  readonly position: THREE.Vector3

  private readonly model: WizardModel
  private readonly originalBodyEmissive: THREE.Color
  private readonly originalBodyEmissiveIntensity: number

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

  // Ice barrier shield
  shieldHp    = 0
  shieldTimer = 0
  private shieldMesh: THREE.Mesh | null = null

  // Death animation
  isDying    = false
  deathTimer = 0
  private readonly deathDuration = 1.2

  constructor() {
    this.model = buildWizardModel({
      bodyColor:         0xeeeeff,
      accentColor:       0xffffff,
      hatColor:          0x222244,
      orbColor:          0xaaccff,
      height:            1.5,
      radius:            PLAYER_RADIUS,
      emissiveIntensity: 0.3,
    })
    this.mesh = this.model.root
    this.mesh.position.set(0, 0, 0)
    this.position = this.mesh.position
    const bodyMat = this.model.body.material as THREE.MeshStandardMaterial
    this.originalBodyEmissive = bodyMat.emissive.clone()
    this.originalBodyEmissiveIntensity = bodyMat.emissiveIntensity
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
        this.setOpacity(1)
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
        this.clearTint()
      }
      return  // Cannot move or act while healing
    }

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

    // Reset after movement so hazard slow from session.update() persists into next frame
    this.speedMultiplier = 1.0

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

    // Shield timer
    if (this.shieldTimer > 0) {
      this.shieldTimer -= delta
      if (this.shieldTimer <= 0) this.removeShield()
    }
  }

  takeDamage(amount: number): void {
    // if (import.meta.env.DEV) return
    if (this.isDodging) return  // i-frames during dodge
    if (this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, amount)
      this.shieldHp -= absorbed
      amount -= absorbed
      if (this.shieldHp <= 0) this.removeShield()
      if (amount <= 0) return
    }
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
    this.setOpacity(0.4)

    return true
  }

  useFlask(): boolean {
    if (this.flasks <= 0 || this.isHealing || this.hp >= this.maxHp || this.hp <= 0) return false
    this.flasks -= 1
    this.isHealing = true
    this.healTimer = FLASK_CAST_TIME
    // Green tint during heal
    this.setTint(0x003300, 1)
    return true
  }

  addFlask(): boolean {
    if (this.flasks >= this.maxFlasks) return false
    this.flasks += 1
    return true
  }

  activateShield(hp: number, duration: number): void {
    this.shieldHp = hp
    this.shieldTimer = duration
    if (!this.shieldMesh) {
      const geo = new THREE.SphereGeometry(PLAYER_RADIUS * 2, 16, 12)
      const mat = new THREE.MeshStandardMaterial({
        color:             new THREE.Color('#aaddff'),
        emissive:          new THREE.Color('#00ffff'),
        emissiveIntensity: 1.0,
        transparent:       true,
        opacity:           0.3,
      })
      this.shieldMesh = new THREE.Mesh(geo, mat)
      this.shieldMesh.position.set(0, 0, 0)
      this.mesh.add(this.shieldMesh)
    }
  }

  removeShield(): void {
    if (this.shieldMesh) {
      this.mesh.remove(this.shieldMesh)
      this.shieldMesh.geometry.dispose()
      ;(this.shieldMesh.material as THREE.MeshStandardMaterial).dispose()
      this.shieldMesh = null
    }
    this.shieldHp = 0
    this.shieldTimer = 0
  }

  startDying(): void {
    this.isDying = true
    this.deathTimer = this.deathDuration
    this.alive = false
  }

  updateDeath(delta: number): boolean {
    this.deathTimer -= delta
    const t = Math.min(1, 1 - (this.deathTimer / this.deathDuration))

    // Y-scale shrinks, X/Z expand
    this.mesh.scale.set(1 + t * 1.0, 1 - t * 0.9, 1 + t * 1.0)

    // Mesh sinks
    this.mesh.position.y = -0.4 * t

    // Material fades
    this.setOpacity(1 - t * 0.8)

    return this.deathTimer <= 0
  }

  setTint(color: number, intensity = 1): void {
    const mat = this.model.body.material as THREE.MeshStandardMaterial
    mat.emissive.setHex(color)
    mat.emissiveIntensity = intensity
  }

  clearTint(): void {
    const mat = this.model.body.material as THREE.MeshStandardMaterial
    mat.emissive.copy(this.originalBodyEmissive)
    mat.emissiveIntensity = this.originalBodyEmissiveIntensity
  }

  setOpacity(opacity: number): void {
    for (const child of [this.model.body, this.model.head, this.model.hat, this.model.staff, this.model.orb]) {
      const m = child.material as THREE.MeshStandardMaterial
      m.transparent = opacity < 1
      m.opacity = opacity
    }
  }

  disposeModel(): void {
    disposeWizardModel(this.model)
  }
}
