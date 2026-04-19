import * as THREE from 'three'
import type { HazardDefinition } from './BiomeDefinitions'
import type { RoomData } from './DungeonGenerator'
import type { Player } from '../entities/Player'
import { mulberry32 } from '../utils/MathUtils'

interface Hazard {
  def:        HazardDefinition
  mesh:       THREE.Mesh
  position:   THREE.Vector3
  timer:      number
  stormTimer: number
}

const DOOR_CLEAR   = 4
const ENEMY_CLEAR  = 3
const HAZARD_CLEAR = 3

function buildHazardTexture(type: HazardDefinition['type']): THREE.CanvasTexture {
  const SIZE = 256
  const cv   = document.createElement('canvas')
  cv.width   = SIZE
  cv.height  = SIZE
  const ctx  = cv.getContext('2d')!

  switch (type) {
    case 'lava_patch': {
      ctx.fillStyle = '#1a0000'
      ctx.fillRect(0, 0, SIZE, SIZE)
      for (let i = 0; i < 10; i++) {
        const cx    = Math.random() * SIZE
        const cy    = Math.random() * SIZE
        const r     = 18 + Math.random() * 38
        const sides = 4 + Math.floor(Math.random() * 4)
        const rr    = Math.floor(180 + Math.random() * 75)
        const gg    = Math.floor(40 + Math.random() * 70)
        ctx.fillStyle   = `rgba(${rr},${gg},0,0.85)`
        ctx.strokeStyle = '#ff8800'
        ctx.lineWidth   = 1.5
        ctx.beginPath()
        for (let j = 0; j < sides; j++) {
          const angle = (j / sides) * Math.PI * 2 + Math.random() * 0.6
          const rad   = r * (0.55 + Math.random() * 0.45)
          const px    = cx + Math.cos(angle) * rad
          const py    = cy + Math.sin(angle) * rad
          j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }
      // crack lines
      ctx.strokeStyle = '#ff4400'
      ctx.lineWidth = 1
      for (let i = 0; i < 6; i++) {
        const sx = Math.random() * SIZE
        const sy = Math.random() * SIZE
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        let cx = sx, cy = sy
        for (let s = 0; s < 4; s++) {
          cx += (Math.random() - 0.5) * 40
          cy += (Math.random() - 0.5) * 40
          ctx.lineTo(cx, cy)
        }
        ctx.stroke()
      }
      break
    }

    case 'ice_floor': {
      ctx.fillStyle = '#b8ddf0'
      ctx.fillRect(0, 0, SIZE, SIZE)
      // subtle inner glow
      const grd = ctx.createRadialGradient(SIZE/2, SIZE/2, 0, SIZE/2, SIZE/2, SIZE/2)
      grd.addColorStop(0, 'rgba(255,255,255,0.6)')
      grd.addColorStop(1, 'rgba(170,220,255,0)')
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, SIZE, SIZE)
      // fracture lines from center
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 1.5
      for (let i = 0; i < 14; i++) {
        const angle  = (i / 14) * Math.PI * 2
        const length = 55 + Math.random() * 60
        const ex     = SIZE/2 + Math.cos(angle) * length
        const ey     = SIZE/2 + Math.sin(angle) * length
        ctx.beginPath()
        ctx.moveTo(SIZE/2, SIZE/2)
        ctx.lineTo(ex, ey)
        ctx.stroke()
        // branch
        const bAngle = angle + (Math.random() * 0.7 - 0.35)
        const bLen   = length * 0.35
        const mx     = SIZE/2 + Math.cos(angle) * length * 0.5
        const my     = SIZE/2 + Math.sin(angle) * length * 0.5
        ctx.beginPath()
        ctx.moveTo(mx, my)
        ctx.lineTo(mx + Math.cos(bAngle) * bLen, my + Math.sin(bAngle) * bLen)
        ctx.stroke()
      }
      break
    }

    case 'storm_zone': {
      ctx.fillStyle = '#0a0a18'
      ctx.fillRect(0, 0, SIZE, SIZE)
      for (let r = 16; r < SIZE; r += 22) {
        const alpha = 0.12 + (r / SIZE) * 0.12
        ctx.strokeStyle = `rgba(255,255,100,${alpha})`
        ctx.lineWidth = 1 + (r / SIZE) * 1.5
        ctx.beginPath()
        ctx.arc(SIZE/2, SIZE/2, r, 0, Math.PI * 2)
        ctx.stroke()
      }
      // faint lightning bolts
      ctx.strokeStyle = 'rgba(255,255,150,0.25)'
      ctx.lineWidth = 1
      for (let i = 0; i < 4; i++) {
        const sx = SIZE/2
        const sy = SIZE/2
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        let cx = sx + (Math.random() - 0.5) * 60
        let cy = sy + (Math.random() - 0.5) * 60
        for (let s = 0; s < 3; s++) {
          ctx.lineTo(cx, cy)
          cx += (Math.random() - 0.5) * 50
          cy += (Math.random() - 0.5) * 50
        }
        ctx.stroke()
      }
      break
    }

    case 'void_rift': {
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, SIZE, SIZE)
      // outer dark glow
      const grd2 = ctx.createRadialGradient(SIZE/2, SIZE/2, SIZE/4, SIZE/2, SIZE/2, SIZE/2)
      grd2.addColorStop(0, 'rgba(80,0,120,0.4)')
      grd2.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grd2
      ctx.fillRect(0, 0, SIZE, SIZE)
      // spiral arms
      for (let arm = 0; arm < 3; arm++) {
        const armOff = (arm / 3) * Math.PI * 2
        ctx.strokeStyle = `rgba(${100 + arm*30},0,${180 + arm*25},0.85)`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(SIZE/2, SIZE/2)
        for (let t = 0; t < Math.PI * 3.5; t += 0.06) {
          const rr = t * 11
          const px = SIZE/2 + Math.cos(t + armOff) * rr
          const py = SIZE/2 + Math.sin(t + armOff) * rr
          if (px < 2 || px > SIZE-2 || py < 2 || py > SIZE-2) break
          ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      break
    }
  }

  const tex       = new THREE.CanvasTexture(cv)
  tex.needsUpdate = true
  return tex
}

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
      const x   = (rng() * 2 - 1) * (half - 1)
      const z   = (rng() * 2 - 1) * (half - 1)
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
      const dist   = player.position.distanceTo(h.position)
      const inRange = dist < h.def.radius
      const mat    = h.mesh.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = inRange ? 1.5 : 0.5

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
            player.knockbackVelocity.set(Math.cos(angle) * h.def.value, 0, Math.sin(angle) * h.def.value)
          }
          break
      }
    }
  }

  clear(scene: THREE.Scene): void {
    for (const h of this.hazards) {
      scene.remove(h.mesh)
      h.mesh.geometry.dispose()
      const mat = h.mesh.material as THREE.MeshStandardMaterial
      if (mat.map) mat.map.dispose()
      mat.dispose()
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
    const geo     = new THREE.CylinderGeometry(def.radius, def.radius, 0.05, 32)
    const texture = buildHazardTexture(def.type)
    const mat     = new THREE.MeshStandardMaterial({
      map:               texture,
      emissive:          new THREE.Color(def.color),
      emissiveIntensity: 0.5,
      transparent:       def.type === 'ice_floor' || def.type === 'storm_zone',
      opacity:           def.type === 'ice_floor' ? 0.65 : def.type === 'storm_zone' ? 0.82 : 1.0,
    })
    return new THREE.Mesh(geo, mat)
  }

  private animateHazard(h: Hazard, delta: number, _scene: THREE.Scene): void {
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
        break
      }
      case 'void_rift':
        h.mesh.rotation.y += delta * 0.8
        break
    }
  }
}
