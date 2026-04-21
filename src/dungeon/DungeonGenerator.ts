import { mulberry32 } from '../utils/MathUtils'
import type { BiomeType } from './BiomeDefinitions'

export type RoomType = 'start' | 'normal' | 'elite' | 'rest' | 'boss'
export type Direction = 'north' | 'south' | 'east' | 'west'

export interface RoomData {
  id: string
  gridX: number
  gridY: number
  type: RoomType
  biome: BiomeType
  depth: number
  hazardCount: number
  connections: Direction[]
  enemies: EnemySpawnData[]
  cleared: boolean
  visited: boolean
}

export interface EnemySpawnData {
  archetype: 'apprentice' | 'battle_mage' | 'boss'
  spellIds: string[]
  position: { x: number; z: number }
  depth: number
}

export interface DungeonData {
  grid: (RoomData | null)[][]
  rooms: RoomData[]
  startRoom: RoomData
  bossRoom: RoomData
}

export const OPPOSITE_DIR: Record<Direction, Direction> = {
  north: 'south', south: 'north', east: 'west', west: 'east',
}

const DIR_OFFSETS: Record<Direction, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy:  1 },
  west:  { dx: -1, dy: 0 },
  east:  { dx:  1, dy: 0 },
}

export function getNeighborRoom(
  grid: (RoomData | null)[][],
  room: RoomData,
  dir: Direction,
): RoomData | null {
  const { dx, dy } = DIR_OFFSETS[dir]
  const nx = room.gridX + dx
  const ny = room.gridY + dy
  if (nx < 0 || nx > 6 || ny < 0 || ny > 6) return null
  return grid[ny][nx]
}

function cardinalNeighbors(x: number, y: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = []
  if (x > 0) out.push({ x: x - 1, y })
  if (x < 6) out.push({ x: x + 1, y })
  if (y > 0) out.push({ x, y: y - 1 })
  if (y < 6) out.push({ x, y: y + 1 })
  return out
}

export function generateDungeon(seed: number): DungeonData {
  const rng = mulberry32(seed)

  const grid: (RoomData | null)[][] = Array.from({ length: 7 }, () => Array(7).fill(null))

  const startX = 1 + Math.floor(rng() * 5)
  const startY = 1 + Math.floor(rng() * 5)

  const target = 10 + Math.floor(rng() * 5)
  const path: Array<{ x: number; y: number }> = [{ x: startX, y: startY }]
  const inPath = new Set<string>([`${startX},${startY}`])
  let cx = startX, cy = startY

  while (path.length < target) {
    const free = cardinalNeighbors(cx, cy).filter(n => !inPath.has(`${n.x},${n.y}`))
    if (free.length > 0) {
      const next = free[Math.floor(rng() * free.length)]
      path.push(next)
      inPath.add(`${next.x},${next.y}`)
      cx = next.x; cy = next.y
    } else {
      let moved = false
      for (const p of path) {
        if (cardinalNeighbors(p.x, p.y).some(n => !inPath.has(`${n.x},${n.y}`))) {
          cx = p.x; cy = p.y; moved = true; break
        }
      }
      if (!moved) break
    }
  }

  const connMap = new Map<string, Set<Direction>>()
  for (const p of path) {
    const key = `${p.x},${p.y}`
    if (!connMap.has(key)) connMap.set(key, new Set())
    for (const [dir, { dx, dy }] of Object.entries(DIR_OFFSETS) as Array<[Direction, { dx: number; dy: number }]>) {
      const nk = `${p.x + dx},${p.y + dy}`
      if (inPath.has(nk)) {
        connMap.get(key)!.add(dir)
        if (!connMap.has(nk)) connMap.set(nk, new Set())
        connMap.get(nk)!.add(OPPOSITE_DIR[dir])
      }
    }
  }

  const startKey = `${startX},${startY}`
  const bossCell = path[path.length - 1]
  const bossKey  = `${bossCell.x},${bossCell.y}`

  const bossAdjacentKeys = new Set(
    cardinalNeighbors(bossCell.x, bossCell.y)
      .filter(n => inPath.has(`${n.x},${n.y}`))
      .map(n => `${n.x},${n.y}`),
  )

  // Place one shrine room adjacent to boss (the room just before boss on the path)
  const preBossCell = path[path.length - 2]
  const restKeys = new Set([`${preBossCell.x},${preBossCell.y}`])

  const rooms: RoomData[] = []
  for (const p of path) {
    const key = `${p.x},${p.y}`
    let type: RoomType
    if      (key === startKey)                          type = 'start'
    else if (key === bossKey)                           type = 'boss'
    else if (restKeys.has(key))                         type = 'rest'
    else if (bossAdjacentKeys.has(key))                 type = 'elite'
    else                                                type = 'normal'

    const room: RoomData = {
      id: key,
      gridX: p.x, gridY: p.y,
      type,
      biome: 'stone',
      depth: 0,
      hazardCount: 0,
      connections: Array.from(connMap.get(key)!),
      enemies: [],
      cleared: type === 'start' || type === 'rest',
      visited: type === 'start',
    }
    grid[p.y][p.x] = room
    rooms.push(room)
  }

  const startRoom = rooms.find(r => r.type === 'start')!
  const bossRoom  = rooms.find(r => r.type === 'boss')!
  return { grid, rooms, startRoom, bossRoom }
}
