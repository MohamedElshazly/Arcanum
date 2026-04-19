// src/dungeon/Room.ts
import * as THREE from 'three'
import { WALL_HEIGHT } from '../constants'
import { mulberry32 } from '../utils/MathUtils'
import type { Direction, RoomData } from './DungeonGenerator'
import type { BiomeDefinition } from './BiomeDefinitions'

export interface RoomBounds {
  minX: number; maxX: number; minZ: number; maxZ: number
}

export interface Obstacle {
  x: number; z: number; r: number
}

const DOOR_HALF  = 2
const CORR_LEN   = 8
const WALL_T     = 1
const CORR_HALF  = DOOR_HALF

export class Room {
  readonly bounds:   RoomBounds
  readonly roomSize: number

  private meshes: THREE.Object3D[] = []
  private doorMeshes = new Map<Direction, THREE.Mesh>()
  private obstacleList: Obstacle[] = []
  private arcaneObstacles: THREE.Mesh[] = []
  private obstacleTimer = 0

  constructor(
    private readonly data: RoomData,
    private readonly biome: BiomeDefinition,
  ) {
    this.roomSize = data.type === 'boss' ? 30 : 20
    const half = this.roomSize / 2
    this.bounds = {
      minX: -half + WALL_T,
      maxX:  half - WALL_T,
      minZ: -half + WALL_T,
      maxZ:  half - WALL_T,
    }
  }

  get obstacles(): readonly Obstacle[] { return this.obstacleList }

  build(scene: THREE.Scene): void {
    this.addMesh(scene, this.buildFloor())
    for (const w of this.buildWalls()) this.addMesh(scene, w)
    for (const dir of this.data.connections) {
      for (const m of this.buildCorridor(dir)) this.addMesh(scene, m)
      this.buildDoor(scene, dir)
    }
    if (this.data.type === 'rest') this.buildShrine(scene)
    if (this.data.type !== 'start' && this.data.type !== 'rest') {
      this.buildObstacles(scene)
    }
  }

  update(delta: number): void {
    this.obstacleTimer += delta
    for (const mesh of this.arcaneObstacles) {
      mesh.rotation.y += delta * 0.7
      mesh.position.y = 1.2 + Math.sin(this.obstacleTimer * 1.8 + mesh.position.x) * 0.18
    }
  }

  dispose(scene: THREE.Scene): void {
    for (const m of this.meshes) {
      scene.remove(m)
      if (m instanceof THREE.Mesh) {
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      }
    }
    this.meshes = []
    this.doorMeshes.clear()
    this.obstacleList = []
    this.arcaneObstacles = []
  }

  openAllDoors(scene: THREE.Scene): void {
    for (const dir of this.data.connections) this.setDoorOpen(scene, dir, true)
  }

  checkDoorCrossing(playerPos: THREE.Vector3): Direction | null {
    if (playerPos.z < this.bounds.minZ + 1 && Math.abs(playerPos.x) < DOOR_HALF) return 'north'
    if (playerPos.z > this.bounds.maxZ - 1 && Math.abs(playerPos.x) < DOOR_HALF) return 'south'
    if (playerPos.x < this.bounds.minX + 1 && Math.abs(playerPos.z) < DOOR_HALF) return 'west'
    if (playerPos.x > this.bounds.maxX - 1 && Math.abs(playerPos.z) < DOOR_HALF) return 'east'
    return null
  }

  getSpawnPosition(enterFromDir: Direction): THREE.Vector3 {
    const half = this.roomSize / 2
    const inner = half - WALL_T - 1.5
    switch (enterFromDir) {
      case 'north': return new THREE.Vector3(0, 0, -inner)
      case 'south': return new THREE.Vector3(0, 0,  inner)
      case 'west':  return new THREE.Vector3(-inner, 0, 0)
      case 'east':  return new THREE.Vector3( inner, 0, 0)
    }
  }

  // ── Obstacles ─────────────────────────────────────────────────────────────

  private buildObstacles(scene: THREE.Scene): void {
    const rng   = mulberry32(this.data.gridX * 7919 + this.data.gridY * 3571 + 54321)
    const half  = this.roomSize / 2
    const inner = half - 3
    const count = 2 + Math.floor(rng() * 5)  // 2-6

    const doorPositions = this.data.connections.map(dir => {
      switch (dir) {
        case 'north': return { x: 0,     z: -half }
        case 'south': return { x: 0,     z:  half }
        case 'west':  return { x: -half, z: 0     }
        case 'east':  return { x:  half, z: 0     }
      }
    })

    const enemyPositions = this.data.enemies.map(e => ({ x: e.position.x, z: e.position.z }))
    const placed: Obstacle[] = []

    for (let attempt = 0; attempt < count * 30 && placed.length < count; attempt++) {
      const x = (rng() * 2 - 1) * inner
      const z = (rng() * 2 - 1) * inner
      const { mesh, r, yOff } = this.buildObstacleMesh(rng)

      if (doorPositions.some(dp => Math.hypot(x - dp.x, z - dp.z) < 4)) continue
      if (enemyPositions.some(ep => Math.hypot(x - ep.x, z - ep.z) < 3)) continue
      if (placed.some(p => Math.hypot(x - p.x, z - p.z) < p.r + r + 0.5)) continue

      mesh.position.set(x, yOff, z)
      scene.add(mesh)
      this.meshes.push(mesh)

      if (this.biome.type === 'arcane') {
        this.arcaneObstacles.push(mesh)
      }

      const obs: Obstacle = { x, z, r }
      this.obstacleList.push(obs)
      placed.push(obs)
    }
  }

  private buildObstacleMesh(rng: () => number): { mesh: THREE.Mesh; r: number; yOff: number } {
    switch (this.biome.type) {
      case 'stone': {
        const geo = new THREE.BoxGeometry(0.8, 3.0, 0.8)
        const mat = new THREE.MeshStandardMaterial({ color: 0x666666, emissive: new THREE.Color(0x222222) })
        return { mesh: new THREE.Mesh(geo, mat), r: 0.6, yOff: 1.5 }
      }
      case 'fire': {
        const geo = new THREE.BoxGeometry(0.7, 2.5, 0.7)
        const mat = new THREE.MeshStandardMaterial({ color: 0x331100, emissive: new THREE.Color(0x441100), emissiveIntensity: 0.6 })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.rotation.y = rng() * Math.PI
        return { mesh, r: 0.55, yOff: 1.25 }
      }
      case 'ice': {
        const geo = new THREE.CylinderGeometry(0.3, 0.4, 3.2, 8)
        const mat = new THREE.MeshStandardMaterial({ color: 0xaaddff, emissive: new THREE.Color(0x224466), emissiveIntensity: 0.5, transparent: true, opacity: 0.88 })
        return { mesh: new THREE.Mesh(geo, mat), r: 0.45, yOff: 1.6 }
      }
      case 'lightning': {
        const geo = new THREE.CylinderGeometry(0.1, 0.12, 4.5, 6)
        const mat = new THREE.MeshStandardMaterial({ color: 0x888888, emissive: new THREE.Color(0xffff44), emissiveIntensity: 1.2 })
        return { mesh: new THREE.Mesh(geo, mat), r: 0.25, yOff: 2.25 }
      }
      case 'arcane': {
        const geo = new THREE.OctahedronGeometry(0.7)
        const mat = new THREE.MeshStandardMaterial({ color: 0x220044, emissive: new THREE.Color(0x8800cc), emissiveIntensity: 2.0 })
        return { mesh: new THREE.Mesh(geo, mat), r: 0.7, yOff: 1.2 }
      }
      case 'void':
      default: {
        const geo = new THREE.BoxGeometry(0.9, 5.0, 0.3)
        const mat = new THREE.MeshStandardMaterial({ color: 0x050005, emissive: new THREE.Color(0x330033), emissiveIntensity: 0.6 })
        return { mesh: new THREE.Mesh(geo, mat), r: 0.6, yOff: 2.5 }
      }
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private setDoorOpen(scene: THREE.Scene, dir: Direction, open: boolean): void {
    const door = this.doorMeshes.get(dir)
    if (door && open) {
      scene.remove(door)
      this.meshes = this.meshes.filter(m => m !== door)
      door.geometry.dispose()
      ;(door.material as THREE.Material).dispose()
    }
  }

  private addMesh(scene: THREE.Scene, mesh: THREE.Object3D): void {
    scene.add(mesh)
    this.meshes.push(mesh)
  }

  private buildFloor(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(this.roomSize, this.roomSize)
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.biome.floorColor) })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    return mesh
  }

  private buildWalls(): THREE.Mesh[] {
    const mat  = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.biome.wallColor) })
    const half = this.roomSize / 2
    const wh   = WALL_HEIGHT / 2
    const walls: THREE.Mesh[] = []

    const dirs: Direction[] = ['north', 'south', 'east', 'west']
    for (const dir of dirs) {
      const hasDoor = this.data.connections.includes(dir)
      if (!hasDoor) {
        const [w, d, x, z] = this.wallDims(dir, false, 0)
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_HEIGHT, d), mat.clone())
        m.position.set(x, wh, z)
        walls.push(m)
      } else {
        const isNS  = dir === 'north' || dir === 'south'
        const segLen = (this.roomSize - DOOR_HALF * 2) / 2
        const zPos   = (dir === 'north' ? -1 : 1) * half
        const xPos   = (dir === 'west'  ? -1 : 1) * half

        if (isNS) {
          const lm = new THREE.Mesh(new THREE.BoxGeometry(segLen, WALL_HEIGHT, WALL_T), mat.clone())
          lm.position.set(-(DOOR_HALF + segLen / 2), wh, zPos)
          walls.push(lm)
          const rm = new THREE.Mesh(new THREE.BoxGeometry(segLen, WALL_HEIGHT, WALL_T), mat.clone())
          rm.position.set(DOOR_HALF + segLen / 2, wh, zPos)
          walls.push(rm)
        } else {
          const tm = new THREE.Mesh(new THREE.BoxGeometry(WALL_T, WALL_HEIGHT, segLen), mat.clone())
          tm.position.set(xPos, wh, -(DOOR_HALF + segLen / 2))
          walls.push(tm)
          const bm = new THREE.Mesh(new THREE.BoxGeometry(WALL_T, WALL_HEIGHT, segLen), mat.clone())
          bm.position.set(xPos, wh, DOOR_HALF + segLen / 2)
          walls.push(bm)
        }
      }
    }
    return walls
  }

  private wallDims(dir: Direction, _hasDoor: boolean, _offset: number): [number, number, number, number] {
    const half = this.roomSize / 2
    switch (dir) {
      case 'north': return [this.roomSize, WALL_T, 0, -half]
      case 'south': return [this.roomSize, WALL_T, 0,  half]
      case 'west':  return [WALL_T, this.roomSize, -half, 0]
      case 'east':  return [WALL_T, this.roomSize,  half, 0]
    }
  }

  private buildCorridor(dir: Direction): THREE.Mesh[] {
    const mat  = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.biome.floorColor) })
    const wmat = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.biome.wallColor) })
    const half = this.roomSize / 2
    const wh   = WALL_HEIGHT / 2
    const meshes: THREE.Mesh[] = []

    const isNS = dir === 'north' || dir === 'south'
    const sign  = (dir === 'north' || dir === 'west') ? -1 : 1

    if (isNS) {
      const zCenter = sign * (half + CORR_LEN / 2)
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(CORR_HALF * 2, CORR_LEN), mat)
      floor.rotation.x = -Math.PI / 2
      floor.position.set(0, 0, zCenter)
      meshes.push(floor)
      for (const sx of [-1, 1]) {
        const sw = new THREE.Mesh(new THREE.BoxGeometry(WALL_T, WALL_HEIGHT, CORR_LEN), wmat.clone())
        sw.position.set(sx * CORR_HALF, wh, zCenter)
        meshes.push(sw)
      }
    } else {
      const xCenter = sign * (half + CORR_LEN / 2)
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(CORR_LEN, CORR_HALF * 2), mat)
      floor.rotation.x = -Math.PI / 2
      floor.position.set(xCenter, 0, 0)
      meshes.push(floor)
      for (const sz of [-1, 1]) {
        const sw = new THREE.Mesh(new THREE.BoxGeometry(CORR_LEN, WALL_HEIGHT, WALL_T), wmat.clone())
        sw.position.set(xCenter, wh, sz * CORR_HALF)
        meshes.push(sw)
      }
    }
    return meshes
  }

  private buildDoor(scene: THREE.Scene, dir: Direction): void {
    const half = this.roomSize / 2
    const mat  = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.biome.wallColor) })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(
      dir === 'north' || dir === 'south' ? DOOR_HALF * 2 : WALL_T,
      WALL_HEIGHT,
      dir === 'east'  || dir === 'west'  ? DOOR_HALF * 2 : WALL_T,
    ), mat)

    const sign = (dir === 'north' || dir === 'west') ? -1 : 1
    if (dir === 'north' || dir === 'south') mesh.position.set(0, WALL_HEIGHT / 2, sign * half)
    else                                    mesh.position.set(sign * half, WALL_HEIGHT / 2, 0)

    if (!this.data.cleared) {
      scene.add(mesh)
      this.meshes.push(mesh)
      this.doorMeshes.set(dir, mesh)
    }
  }

  private buildShrine(scene: THREE.Scene): void {
    const geo  = new THREE.OctahedronGeometry(0.5)
    const mat  = new THREE.MeshStandardMaterial({
      color: 0x00ff88, emissive: new THREE.Color(0x00ff44), emissiveIntensity: 1.5,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(0, 0.5, 0)
    mesh.name = 'shrine'
    scene.add(mesh)
    this.meshes.push(mesh)
  }
}
