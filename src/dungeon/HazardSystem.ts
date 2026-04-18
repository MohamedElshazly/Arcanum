import * as THREE from 'three'
import type { HazardDefinition } from './BiomeDefinitions'
import type { RoomData } from './DungeonGenerator'
import type { Player } from '../entities/Player'
import { mulberry32 } from '../utils/MathUtils'

interface Hazard {
  def:      HazardDefinition
  mesh:     THREE.Mesh
  position: THREE.Vector3
  timer:    number
  stormTimer: number
}

const DOOR_CLEAR   = 4
const ENEMY_CLEAR  = 3
const HAZARD_CLEAR = 3

export class HazardSystem {
  private hazards: Hazard[] = []

  spawnForRoom(
    roomData: RoomData,
    hazardDefs: HazardDefinition[],
    scene: THREE.Scene,
    seed: number,
  ): void {
    this.clear(scene)
    if (roomData.hazardCount === 0 || hazardDefs.length === 0) return

    const rng   = mulberry32(seed)
    const count = this.targetCount(roomData.hazardCount, rng)
    const half  = roomData.type === 'boss' ? 14 : 9

    const doorPositions = roomData.connections.map(dir => {
      const h = half + 1
      switch (dir) {
        case 'north': return new THREE.Vector3(0, 0, -h)
        case 'south': return new THREE.Vector3(0, 0,  h)
        case 'west':  return new THREE.Vector3(-h, 0, 0)
        case 'east':  return new THREE.Vector3( h, 0, 0)
        default:      return new THREE.Vector3(0, 0, 0)
      }
    })

    const placed: THREE.Vector3[] = []

    for (let attempt = 0; attempt < count * 20 && placed.length < count; attempt++) {
      const x = (rng() * 2 - 1) * (half - 1)
      const z = (rng() * 2 - 1) * (half - 1)
      const pos = new THREE.Vector3(x, 0, z)

      if (doorPositions.some(dp => pos.distanceTo(dp) < DOOR_CLEAR)) continue
      if (roomData.enemies.some(e => {
        const ep = new THREE.Vector3(e.position.x, 0, e.position.z)
        return pos.distanceTo(ep) < ENEMY_CLEAR
      })) continue
      if (placed.some(p => pos.distanceTo(p) < HAZARD_CLEAR)) continue

      const def  = hazardDefs[Math.floor(rng() * hazardDefs.length)]
      const mesh = this.buildMesh(def)
      mesh.position.copy(pos)
      scene.add(mesh)
      this.hazards.push({ def, mesh, position: pos, timer: 0, stormTimer: 0 })
      placed.push(pos)
    }
  }

  update(delta: number, player: Player, scene: THREE.Scene): void {
    for (const h of this.hazards) {
      h.timer += delta
      const dist = player.position.distanceTo(h.position)
      const inRange = dist < h.def.radius

      const mat = h.mesh.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = inRange ? 1.5 : 0.6

      this.animateHazard(h, delta, scene)

      if (!inRange) continue

      switch (h.def.effect) {
        case 'damage_over_time':
          player.takeDamage(h.def.value * delta)
          break
        case 'slow':
          player.speedMultiplier = Math.min(player.speedMultiplier, 1 - h.def.value)
          break
        case 'mana_drain':
          player.mana = Math.max(0, player.mana - h.def.value * delta)
          break
        case 'random_knockback':
          h.stormTimer += delta
          if (h.stormTimer >= 2.0) {
            h.stormTimer = 0
            const angle = Math.random() * Math.PI * 2
            player.knockbackVelocity.set(
              Math.cos(angle) * h.def.value,
              0,
              Math.sin(angle) * h.def.value,
            )
          }
          break
      }
    }
  }

  clear(scene: THREE.Scene): void {
    for (const h of this.hazards) {
      scene.remove(h.mesh)
      h.mesh.geometry.dispose()
      ;(h.mesh.material as THREE.Material).dispose()
    }
    this.hazards = []
  }

  private targetCount(hazardCount: number, rng: () => number): number {
    switch (hazardCount) {
      case 1: return 1 + Math.floor(rng() * 2)
      case 2: return 2 + Math.floor(rng() * 3)
      case 3: return 4 + Math.floor(rng() * 3)
      default: return 0
    }
  }

  private buildMesh(def: HazardDefinition): THREE.Mesh {
    const geo  = new THREE.CylinderGeometry(def.radius, def.radius, 0.05, 24)
    const mat  = new THREE.MeshStandardMaterial({
      color:             new THREE.Color(def.color),
      emissive:          new THREE.Color(def.color),
      emissiveIntensity: 0.6,
      transparent:       def.type === 'ice_floor',
      opacity:           def.type === 'ice_floor' ? 0.6 : 1.0,
    })
    return new THREE.Mesh(geo, mat)
  }

  private animateHazard(h: Hazard, _delta: number, _scene: THREE.Scene): void {
    const t = h.timer
    switch (h.def.type) {
      case 'lava_patch': {
        const s = 1 + Math.sin(t * 3) * 0.06
        h.mesh.scale.set(s, 1, s)
        break
      }
      case 'storm_zone': {
        const mat = h.mesh.material as THREE.MeshStandardMaterial
        mat.opacity = 0.5 + Math.sin(t * 4) * 0.3
        mat.transparent = true
        break
      }
      case 'void_rift':
        h.mesh.rotation.y += _delta * 0.8
        break
    }
  }
}
