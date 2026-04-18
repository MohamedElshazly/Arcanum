// src/dungeon/Room.ts
import * as THREE from 'three'
import { WALL_HEIGHT } from '../constants'
import type { Direction, RoomData } from './DungeonGenerator'
import type { BiomeDefinition } from './BiomeDefinitions'

export interface RoomBounds {
  minX: number; maxX: number; minZ: number; maxZ: number
}

const DOOR_HALF  = 2      // half-width of door gap
const CORR_LEN   = 8      // corridor length
const WALL_T     = 1      // wall thickness
const CORR_HALF  = DOOR_HALF

export class Room {
  readonly bounds: RoomBounds
  readonly roomSize: number

  private meshes: THREE.Object3D[] = []
  private doorMeshes  = new Map<Direction, THREE.Mesh>()

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

  build(scene: THREE.Scene): void {
    this.addMesh(scene, this.buildFloor())
    for (const w of this.buildWalls()) this.addMesh(scene, w)
    for (const dir of this.data.connections) {
      for (const m of this.buildCorridor(dir)) this.addMesh(scene, m)
      this.buildDoor(scene, dir)
    }
    if (this.data.type === 'rest') this.buildShrine(scene)
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
  }

  /** Call when player clears the room — open all doors. */
  openAllDoors(scene: THREE.Scene): void {
    for (const dir of this.data.connections) this.setDoorOpen(scene, dir, true)
  }

  /** Returns the Direction the player has "crossed" into, or null. */
  checkDoorCrossing(playerPos: THREE.Vector3): Direction | null {
    const half = this.roomSize / 2
    if (playerPos.z < -(half - WALL_T) && Math.abs(playerPos.x) < DOOR_HALF) return 'north'
    if (playerPos.z >  (half - WALL_T) && Math.abs(playerPos.x) < DOOR_HALF) return 'south'
    if (playerPos.x < -(half - WALL_T) && Math.abs(playerPos.z) < DOOR_HALF) return 'west'
    if (playerPos.x >  (half - WALL_T) && Math.abs(playerPos.z) < DOOR_HALF) return 'east'
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

  private setDoorOpen(scene: THREE.Scene, dir: Direction, open: boolean): void {
    const door = this.doorMeshes.get(dir)
    if (door) {
      if (open) {
        scene.remove(door)
        this.meshes = this.meshes.filter(m => m !== door)
        door.geometry.dispose()
        ;(door.material as THREE.Material).dispose()
      }
    }
  }

  private addMesh(scene: THREE.Scene, mesh: THREE.Object3D): void {
    scene.add(mesh)
    this.meshes.push(mesh)
  }

  private buildFloor(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(this.roomSize, this.roomSize)
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.biome.floorColor),
    })
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
        const isNS = dir === 'north' || dir === 'south'
        const segLen = (this.roomSize - DOOR_HALF * 2) / 2
        const zPos = (dir === 'north' ? -1 : 1) * half
        const xPos = (dir === 'west'  ? -1 : 1) * half

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

    if (this.data.cleared) {
      // gap stays open — don't add door mesh
    } else {
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
