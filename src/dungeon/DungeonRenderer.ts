import * as THREE from 'three'
import type { BiomeDefinition } from './BiomeDefinitions'
import type { SceneManager } from '../core/SceneManager'

interface Particle {
  mesh:     THREE.Mesh
  velocity: THREE.Vector3
  life:     number
  maxLife:  number
}

const PARTICLE_COUNT = 30

export class DungeonRenderer {
  private particles:   Particle[] = []
  private biome:       BiomeDefinition | null = null
  private lightTimer   = 0

  constructor(private readonly sm: SceneManager) {}

  applyBiome(biome: BiomeDefinition, scene: THREE.Scene): void {
    this.biome = biome
    this.lightTimer = 0

    this.sm.ambientLight.color.set(biome.ambientLightColor)
    this.sm.ambientLight.intensity = biome.ambientLightIntensity

    scene.fog = new THREE.FogExp2(biome.fogColor, biome.fogDensity)

    this.clearParticles(scene)
    this.spawnParticles(biome, scene)
  }

  update(delta: number, _scene: THREE.Scene): void {
    if (!this.biome) return

    this.lightTimer += delta

    if (this.biome.type === 'lightning') {
      this.sm.ambientLight.intensity =
        this.biome.ambientLightIntensity * (0.8 + 0.2 * Math.sin(this.lightTimer * 12))
    }

    for (const p of this.particles) {
      p.life -= delta
      p.mesh.position.add(p.velocity.clone().multiplyScalar(delta))

      for (const axis of ['x', 'z'] as const) {
        if (p.mesh.position[axis] >  8) p.mesh.position[axis] = -8
        if (p.mesh.position[axis] < -8) p.mesh.position[axis] =  8
      }

      if (this.biome.type === 'fire') {
        if (p.mesh.position.y > 3) {
          p.mesh.position.y = 0.1
          p.mesh.position.x = (Math.random() * 2 - 1) * 8
          p.mesh.position.z = (Math.random() * 2 - 1) * 8
        }
      }

      const mat = p.mesh.material as THREE.MeshStandardMaterial
      mat.opacity = Math.min(1, p.life / (p.maxLife * 0.3))
    }
  }

  clear(scene: THREE.Scene): void {
    this.clearParticles(scene)
    scene.fog = null
  }

  private spawnParticles(biome: BiomeDefinition, scene: THREE.Scene): void {
    const geo = new THREE.SphereGeometry(0.05, 4, 4)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color:             new THREE.Color(biome.particleColor),
        emissive:          new THREE.Color(biome.particleColor),
        emissiveIntensity: 1.5,
        transparent:       true,
        opacity:           0.8,
      })
      const mesh = new THREE.Mesh(geo.clone(), mat)
      mesh.position.set(
        (Math.random() * 2 - 1) * 8,
        Math.random() * 2.5,
        (Math.random() * 2 - 1) * 8,
      )

      const vel = this.particleVelocity(biome)
      const life = 3 + Math.random() * 5
      scene.add(mesh)
      this.particles.push({ mesh, velocity: vel, life, maxLife: life })
    }
  }

  private particleVelocity(biome: BiomeDefinition): THREE.Vector3 {
    switch (biome.type) {
      case 'fire':
        return new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.2)
      case 'ice':
        return new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3)
      case 'lightning':
        return new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5)
      case 'arcane':
        return new THREE.Vector3(Math.cos(Math.random() * Math.PI * 2) * 0.5, 0, Math.sin(Math.random() * Math.PI * 2) * 0.5)
      default:
        return new THREE.Vector3((Math.random() - 0.5) * 0.1, 0, (Math.random() - 0.5) * 0.1)
    }
  }

  private clearParticles(scene: THREE.Scene): void {
    for (const p of this.particles) {
      scene.remove(p.mesh)
      p.mesh.geometry.dispose()
      ;(p.mesh.material as THREE.Material).dispose()
    }
    this.particles = []
  }
}
