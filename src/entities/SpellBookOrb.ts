import * as THREE from 'three'
import type { SpellElement } from '../spells/SpellDefinitions'
import {
  ORB_SPHERE_RADIUS, ORB_FLOAT_AMPLITUDE, ORB_FLOAT_SPEED, ORB_ROTATION_SPEED,
  ORB_LIGHT_INTENSITY, ORB_LIGHT_DISTANCE,
  ORB_PARTICLE_COUNT, ORB_PARTICLE_RADIUS, ORB_ORBIT_RADIUS, ORB_ORBIT_SPEED,
  ORB_COLLECT_RADIUS, ORB_COLLECT_SCALE_UP_TIME, ORB_COLLECT_SCALE_DOWN_TIME,
} from '../constants'

const ELEMENT_COLOR: Record<SpellElement, number> = {
  fire: 0xff4400, ice: 0x00ccff, lightning: 0xffff00, arcane: 0xaa00ff,
}

type CollectPhase = 'none' | 'scale-up' | 'scale-down'

export class SpellBookOrb {
  private mesh:      THREE.Mesh
  private light:     THREE.PointLight
  private particles: THREE.Mesh[] = []
  private baseY:     number
  private elapsed    = 0
  private spellIds:  string[]
  private element:   SpellElement
  private collectPhase: CollectPhase = 'none'
  private collectTimer  = 0
  collected = false

  constructor(
    position: THREE.Vector3,
    spellIds:  string[],
    element:   SpellElement,
    scene:     THREE.Scene,
  ) {
    this.spellIds = spellIds
    this.element  = element
    this.baseY    = position.y + 0.5

    const color = ELEMENT_COLOR[element] ?? 0xffffff

    const geo = new THREE.SphereGeometry(ORB_SPHERE_RADIUS, 12, 8)
    const mat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color(color),
      emissive:          new THREE.Color(color),
      emissiveIntensity: 2.0,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.set(position.x, this.baseY, position.z)
    scene.add(this.mesh)

    this.light = new THREE.PointLight(new THREE.Color(color), ORB_LIGHT_INTENSITY, ORB_LIGHT_DISTANCE)
    this.light.position.copy(this.mesh.position)
    scene.add(this.light)

    const particleGeo = new THREE.SphereGeometry(ORB_PARTICLE_RADIUS, 6, 4)
    const particleMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color), emissive: new THREE.Color(color), emissiveIntensity: 1.5,
    })
    for (let i = 0; i < ORB_PARTICLE_COUNT; i++) {
      const p = new THREE.Mesh(particleGeo, particleMat.clone())
      scene.add(p)
      this.particles.push(p)
    }
  }

  /** Returns true when player is within collect radius — caller should then call collect(). */
  update(delta: number, playerPosition: THREE.Vector3): boolean {
    if (this.collected) return false

    this.elapsed += delta

    if (this.collectPhase !== 'none') {
      return this.tickCollectAnimation(delta)
    }

    this.mesh.position.y = this.baseY + Math.sin(this.elapsed * ORB_FLOAT_SPEED) * ORB_FLOAT_AMPLITUDE
    this.mesh.rotation.y += delta * ORB_ROTATION_SPEED

    const angle = this.elapsed * ORB_ORBIT_SPEED
    for (let i = 0; i < this.particles.length; i++) {
      const offset = (Math.PI * 2 / ORB_PARTICLE_COUNT) * i
      this.particles[i].position.set(
        this.mesh.position.x + Math.cos(angle + offset) * ORB_ORBIT_RADIUS,
        this.mesh.position.y,
        this.mesh.position.z + Math.sin(angle + offset) * ORB_ORBIT_RADIUS,
      )
    }

    const dx = playerPosition.x - this.mesh.position.x
    const dz = playerPosition.z - this.mesh.position.z
    if (Math.sqrt(dx * dx + dz * dz) < ORB_COLLECT_RADIUS) {
      this.collectPhase = 'scale-up'
      this.collectTimer = 0
      return true
    }
    return false
  }

  private tickCollectAnimation(delta: number): boolean {
    this.collectTimer += delta

    if (this.collectPhase === 'scale-up') {
      const t = Math.min(this.collectTimer / ORB_COLLECT_SCALE_UP_TIME, 1)
      const s = 1 + 0.5 * t
      this.mesh.scale.setScalar(s)
      this.light.intensity = ORB_LIGHT_INTENSITY * (1 + t * 2)
      if (this.collectTimer >= ORB_COLLECT_SCALE_UP_TIME) {
        this.collectPhase = 'scale-down'
        this.collectTimer = 0
      }
    } else if (this.collectPhase === 'scale-down') {
      const t = Math.min(this.collectTimer / ORB_COLLECT_SCALE_DOWN_TIME, 1)
      const s = 1.5 * (1 - t)
      this.mesh.scale.setScalar(s)
      this.light.intensity = ORB_LIGHT_INTENSITY * (1 - t)
      if (this.collectTimer >= ORB_COLLECT_SCALE_DOWN_TIME) {
        this.collected = true
        return false
      }
    }
    return false
  }

  collect(): string[] {
    this.collectPhase = 'scale-up'
    this.collectTimer = 0
    return [...this.spellIds]
  }

  getElement(): SpellElement { return this.element }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh)
    scene.remove(this.light)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.MeshStandardMaterial).dispose()
    for (const p of this.particles) {
      scene.remove(p)
      p.geometry.dispose()
      ;(p.material as THREE.MeshStandardMaterial).dispose()
    }
    this.particles = []
  }
}
