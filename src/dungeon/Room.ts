import * as THREE from 'three'
import { ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, WALL_HEIGHT } from '../constants'

export interface RoomBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export class Room {
  /** Interior walkable bounds — wall thickness already subtracted. */
  readonly bounds: RoomBounds = {
    minX: -(ROOM_WIDTH  / 2) + WALL_THICKNESS,
    maxX:  (ROOM_WIDTH  / 2) - WALL_THICKNESS,
    minZ: -(ROOM_HEIGHT / 2) + WALL_THICKNESS,
    maxZ:  (ROOM_HEIGHT / 2) - WALL_THICKNESS,
  }

  build(scene: THREE.Scene): void {
    scene.add(this.buildFloor())
    this.buildWalls().forEach(w => scene.add(w))
  }

  private buildFloor(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT)
    const mat = new THREE.MeshStandardMaterial({ map: this.buildGridTexture() })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    return mesh
  }

  private buildGridTexture(): THREE.CanvasTexture {
    const size   = 512
    const canvas = document.createElement('canvas')
    canvas.width  = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = '#2a2a4e'
    ctx.lineWidth   = 1
    const cells    = 20
    const cellSize = size / cells
    for (let i = 0; i <= cells; i++) {
      ctx.beginPath(); ctx.moveTo(i * cellSize, 0);    ctx.lineTo(i * cellSize, size); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0,    i * cellSize); ctx.lineTo(size, i * cellSize); ctx.stroke()
    }
    return new THREE.CanvasTexture(canvas)
  }

  private buildWalls(): THREE.Mesh[] {
    const mat = new THREE.MeshStandardMaterial({ color: 0x555566 })
    const hw  = ROOM_WIDTH  / 2
    const hh  = ROOM_HEIGHT / 2
    const wt  = WALL_THICKNESS
    const wh  = WALL_HEIGHT / 2

    // Each entry: [boxWidth, boxDepth, posX, posY, posZ]
    const defs: [number, number, number, number, number][] = [
      [ROOM_WIDTH, wt,          0,            wh,  -hh + wt / 2],  // north
      [ROOM_WIDTH, wt,          0,            wh,   hh - wt / 2],  // south
      [wt,         ROOM_HEIGHT, -hw + wt / 2, wh,   0          ],  // west
      [wt,         ROOM_HEIGHT,  hw - wt / 2, wh,   0          ],  // east
    ]

    return defs.map(([w, d, x, y, z]) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_HEIGHT, d), mat)
      mesh.position.set(x, y, z)
      return mesh
    })
  }
}
