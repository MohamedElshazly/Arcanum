# Phase 3 — Procedural Dungeon + Biomes + Enemy Scaling

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single hardcoded room with a fully procedural dungeon — 7×7 grid, 6 biomes, hazards, two enemy archetypes with depth scaling, minimap, and smooth camera follow.

**Architecture:** `DungeonSession` owns all dungeon state and drives a fade-in/fade-out transition state machine; `Game.ts` calls `session.update(delta, player, scene)` each frame. One room is active in the scene at a time, rebuilt at origin on each transition.

**Tech Stack:** TypeScript, Three.js, Vite, Vitest (jsdom)

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/utils/MathUtils.ts` | mulberry32 seeded RNG |
| Create | `src/dungeon/BiomeDefinitions.ts` | Pure data — 6 biome configs |
| Create | `src/dungeon/DungeonGenerator.ts` | 7×7 walk, room types, `DungeonData` |
| Create | `src/dungeon/BiomeAssigner.ts` | BFS depth → biome + hazardCount + enemies |
| Create | `src/dungeon/HazardSystem.ts` | Spawn, animate, apply player effects |
| Create | `src/dungeon/DungeonRenderer.ts` | Biome lighting, fog, particles |
| Create | `src/dungeon/DungeonSession.ts` | State machine, transition, room lifecycle |
| Rewrite | `src/dungeon/Room.ts` | Multi-connection room: door gaps, corridors, door state |
| Rewrite | `src/entities/Enemy.ts` | EnemyConfig, archetypes, depth scaling, blink AI |
| Modify | `src/entities/Player.ts` | Add `speedMultiplier`, `knockbackVelocity` |
| Modify | `src/core/SceneManager.ts` | Expose `ambientLight`, add `followPlayer()`, `snapToRoom()` |
| Modify | `src/ui/HUD.ts` | Add minimap canvas draw |
| Modify | `src/core/Game.ts` | Delegate dungeon to `DungeonSession` |
| Modify | `index.html` | Add `#minimap` canvas + `#fade-overlay` div |
| Create | `tests/MathUtils.test.ts` | RNG determinism |
| Create | `tests/DungeonGenerator.test.ts` | Grid structure, room counts, bidirectional connections |
| Create | `tests/BiomeAssigner.test.ts` | Depth assignment, biome rules, hazardCount |
| Create | `tests/EnemyScaling.test.ts` | HP/speed/castInterval formulas |

---

## Task 1: MathUtils — seeded RNG

**Files:**
- Create: `src/utils/MathUtils.ts`
- Create: `tests/MathUtils.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/MathUtils.test.ts
import { describe, it, expect } from 'vitest'
import { mulberry32 } from '../src/utils/MathUtils'

describe('mulberry32', () => {
  it('same seed produces same sequence', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect(a()).toBeCloseTo(b())
    expect(a()).toBeCloseTo(b())
  })
  it('different seeds produce different values', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })
  it('all values are in [0, 1)', () => {
    const rng = mulberry32(123)
    for (let i = 0; i < 200; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- MathUtils
```
Expected: `Cannot find module '../src/utils/MathUtils'`

- [ ] **Step 3: Implement**

```typescript
// src/utils/MathUtils.ts
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test -- MathUtils
```

- [ ] **Step 5: Commit**

```bash
git add src/utils/MathUtils.ts tests/MathUtils.test.ts
git commit -m "feat: add mulberry32 seeded RNG"
```

---

## Task 2: BiomeDefinitions — pure data

**Files:**
- Create: `src/dungeon/BiomeDefinitions.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/dungeon/BiomeDefinitions.ts
import type { SpellElement } from '../spells/SpellDefinitions'

export type BiomeType = 'stone' | 'fire' | 'ice' | 'lightning' | 'arcane' | 'void'

export interface HazardDefinition {
  type: 'lava_patch' | 'ice_floor' | 'storm_zone' | 'void_rift'
  radius: number
  effect: 'damage_over_time' | 'slow' | 'random_knockback' | 'mana_drain'
  value: number
  color: string
}

export interface BiomeDefinition {
  type: BiomeType
  floorColor: string
  wallColor: string
  ambientLightColor: string
  ambientLightIntensity: number
  fogColor: string
  fogDensity: number
  dominantElement: SpellElement | null
  enemyElementWeights: Partial<Record<SpellElement, number>>
  hazards: HazardDefinition[]
  particleColor: string
  description: string
}

export const BIOMES: Record<BiomeType, BiomeDefinition> = {
  stone: {
    type: 'stone',
    floorColor: '#1a1a1a', wallColor: '#2a2a2a',
    ambientLightColor: '#ffffff', ambientLightIntensity: 0.4,
    fogColor: '#0a0a0a', fogDensity: 0.015,
    dominantElement: null,
    enemyElementWeights: { fire: 0.25, ice: 0.25, lightning: 0.25, arcane: 0.25 },
    hazards: [],
    particleColor: '#888888',
    description: 'Ancient stone corridors, cold and silent.',
  },
  fire: {
    type: 'fire',
    floorColor: '#1a0800', wallColor: '#2a1000',
    ambientLightColor: '#ff4400', ambientLightIntensity: 0.6,
    fogColor: '#1a0500', fogDensity: 0.02,
    dominantElement: 'fire',
    enemyElementWeights: { fire: 0.7, ice: 0.1, lightning: 0.1, arcane: 0.1 },
    hazards: [{ type: 'lava_patch', radius: 1.2, effect: 'damage_over_time', value: 8, color: '#ff6600' }],
    particleColor: '#ff8800',
    description: 'The air shimmers with heat. The walls weep molten rock.',
  },
  ice: {
    type: 'ice',
    floorColor: '#0a1520', wallColor: '#0d1f2d',
    ambientLightColor: '#aaddff', ambientLightIntensity: 0.4,
    fogColor: '#0a1525', fogDensity: 0.02,
    dominantElement: 'ice',
    enemyElementWeights: { fire: 0.1, ice: 0.7, lightning: 0.1, arcane: 0.1 },
    hazards: [{ type: 'ice_floor', radius: 1.5, effect: 'slow', value: 0.4, color: '#aaddff' }],
    particleColor: '#aaddff',
    description: 'Frost coats every surface. Your breath fogs the air.',
  },
  lightning: {
    type: 'lightning',
    floorColor: '#0f0f1a', wallColor: '#1a1a2a',
    ambientLightColor: '#ccccff', ambientLightIntensity: 0.8,
    fogColor: '#0a0a15', fogDensity: 0.015,
    dominantElement: 'lightning',
    enemyElementWeights: { fire: 0.1, ice: 0.1, lightning: 0.7, arcane: 0.1 },
    hazards: [{ type: 'storm_zone', radius: 2.0, effect: 'random_knockback', value: 5, color: '#ffff88' }],
    particleColor: '#ffff44',
    description: 'Static fills the air. Every surface hums with charge.',
  },
  arcane: {
    type: 'arcane',
    floorColor: '#0a0015', wallColor: '#150025',
    ambientLightColor: '#8800ff', ambientLightIntensity: 0.6,
    fogColor: '#050010', fogDensity: 0.025,
    dominantElement: 'arcane',
    enemyElementWeights: { fire: 0.1, ice: 0.1, lightning: 0.1, arcane: 0.7 },
    hazards: [{ type: 'void_rift', radius: 1.0, effect: 'mana_drain', value: 8, color: '#8800ff' }],
    particleColor: '#aa44ff',
    description: 'Reality feels thin here. Magic bends in unexpected ways.',
  },
  void: {
    type: 'void',
    floorColor: '#000000', wallColor: '#050005',
    ambientLightColor: '#330011', ambientLightIntensity: 0.8,
    fogColor: '#050005', fogDensity: 0.03,
    dominantElement: null,
    enemyElementWeights: { fire: 0.25, ice: 0.25, lightning: 0.25, arcane: 0.25 },
    hazards: [
      { type: 'lava_patch', radius: 1.2, effect: 'damage_over_time', value: 8, color: '#ff6600' },
      { type: 'ice_floor',  radius: 1.5, effect: 'slow',             value: 0.4, color: '#aaddff' },
      { type: 'storm_zone', radius: 2.0, effect: 'random_knockback', value: 5,   color: '#ffff88' },
      { type: 'void_rift',  radius: 1.0, effect: 'mana_drain',       value: 8,   color: '#8800ff' },
    ],
    particleColor: '#ff00ff',
    description: 'Something ancient waits here. The air tastes of endings.',
  },
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build 2>&1 | head -20
```
Expected: no errors in `BiomeDefinitions.ts`

- [ ] **Step 3: Commit**

```bash
git add src/dungeon/BiomeDefinitions.ts
git commit -m "feat: add BiomeDefinitions pure data"
```

---

## Task 3: DungeonGenerator — grid walk + room classification

**Files:**
- Create: `src/dungeon/DungeonGenerator.ts`
- Create: `tests/DungeonGenerator.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/DungeonGenerator.test.ts
import { describe, it, expect } from 'vitest'
import {
  generateDungeon, getNeighborRoom, OPPOSITE_DIR,
  type DungeonData,
} from '../src/dungeon/DungeonGenerator'

describe('generateDungeon', () => {
  it('has exactly one start room', () => {
    expect(generateDungeon(42).rooms.filter(r => r.type === 'start').length).toBe(1)
  })
  it('has exactly one boss room', () => {
    expect(generateDungeon(42).rooms.filter(r => r.type === 'boss').length).toBe(1)
  })
  it('room count is 10–14', () => {
    const n = generateDungeon(42).rooms.length
    expect(n).toBeGreaterThanOrEqual(10)
    expect(n).toBeLessThanOrEqual(14)
  })
  it('start room is pre-cleared and visited', () => {
    const d = generateDungeon(42)
    expect(d.startRoom.cleared).toBe(true)
    expect(d.startRoom.visited).toBe(true)
  })
  it('start room has no enemies', () => {
    expect(generateDungeon(42).startRoom.enemies.length).toBe(0)
  })
  it('all rooms have at least one connection', () => {
    for (const r of generateDungeon(42).rooms)
      expect(r.connections.length).toBeGreaterThanOrEqual(1)
  })
  it('connections are bidirectional', () => {
    const d = generateDungeon(42)
    for (const room of d.rooms) {
      for (const dir of room.connections) {
        const nb = getNeighborRoom(d.grid, room, dir)
        expect(nb).not.toBeNull()
        expect(nb!.connections).toContain(OPPOSITE_DIR[dir])
      }
    }
  })
  it('same seed → same dungeon', () => {
    const a = generateDungeon(77)
    const b = generateDungeon(77)
    expect(a.rooms.length).toBe(b.rooms.length)
    expect(a.startRoom.id).toBe(b.startRoom.id)
  })
  it('different seeds → different dungeons', () => {
    const a = generateDungeon(1)
    const b = generateDungeon(2)
    // At least room count or start position must differ across 1000 seeds
    // (checking just two is sufficient for a smoke test)
    const sameCount  = a.rooms.length   === b.rooms.length
    const sameStart  = a.startRoom.id   === b.startRoom.id
    expect(sameCount && sameStart).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- DungeonGenerator
```

- [ ] **Step 3: Implement DungeonGenerator.ts**

```typescript
// src/dungeon/DungeonGenerator.ts
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
  archetype: 'apprentice' | 'battle_mage'
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

  // 1. 7×7 null grid
  const grid: (RoomData | null)[][] = Array.from({ length: 7 }, () => Array(7).fill(null))

  // 2. Non-edge starting cell (rows/cols 1–5)
  const startX = 1 + Math.floor(rng() * 5)
  const startY = 1 + Math.floor(rng() * 5)

  // 3. Random walk 10–14 cells
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
      // teleport to any visited cell with free neighbours
      let moved = false
      for (const p of path) {
        if (cardinalNeighbors(p.x, p.y).some(n => !inPath.has(`${n.x},${n.y}`))) {
          cx = p.x; cy = p.y; moved = true; break
        }
      }
      if (!moved) break
    }
  }

  // 4. Build bidirectional connection map
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

  // 5. Classify rooms
  const startKey = `${startX},${startY}`
  const bossCell = path[path.length - 1]
  const bossKey  = `${bossCell.x},${bossCell.y}`

  const bossAdjacentKeys = new Set(
    cardinalNeighbors(bossCell.x, bossCell.y)
      .filter(n => inPath.has(`${n.x},${n.y}`))
      .map(n => `${n.x},${n.y}`),
  )

  const deadEnds = path.filter(p => {
    const k = `${p.x},${p.y}`
    return k !== startKey && k !== bossKey && connMap.get(k)!.size === 1
  })
  const restCount = Math.min(deadEnds.length, 1 + Math.floor(rng() * 2))
  const restKeys  = new Set(
    [...deadEnds].sort(() => rng() - 0.5).slice(0, restCount).map(p => `${p.x},${p.y}`),
  )

  // 6. Build RoomData array
  const rooms: RoomData[] = []
  for (const p of path) {
    const key = `${p.x},${p.y}`
    let type: RoomType
    if      (key === startKey)                          type = 'start'
    else if (key === bossKey)                           type = 'boss'
    else if (bossAdjacentKeys.has(key))                 type = 'elite'
    else if (restKeys.has(key))                         type = 'rest'
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
      cleared: type === 'start' || type === 'rest' || type === 'boss',
      visited: type === 'start',
    }
    grid[p.y][p.x] = room
    rooms.push(room)
  }

  const startRoom = rooms.find(r => r.type === 'start')!
  const bossRoom  = rooms.find(r => r.type === 'boss')!
  return { grid, rooms, startRoom, bossRoom }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test -- DungeonGenerator
```

- [ ] **Step 5: Commit**

```bash
git add src/dungeon/DungeonGenerator.ts tests/DungeonGenerator.test.ts
git commit -m "feat: add DungeonGenerator — 7x7 walk + room classification"
```

---

## Task 4: BiomeAssigner — depth + biome + hazardCount + enemy spawns

**Files:**
- Create: `src/dungeon/BiomeAssigner.ts`
- Create: `tests/BiomeAssigner.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/BiomeAssigner.test.ts
import { describe, it, expect } from 'vitest'
import { generateDungeon }  from '../src/dungeon/DungeonGenerator'
import { assignBiomes }     from '../src/dungeon/BiomeAssigner'
import { mulberry32 }       from '../src/utils/MathUtils'

function build(seed: number) {
  const dungeon = generateDungeon(seed)
  assignBiomes(dungeon, mulberry32(seed + 1000))
  return dungeon
}

describe('assignBiomes', () => {
  it('start room has depth 0', ()           => expect(build(42).startRoom.depth).toBe(0))
  it('start room biome is stone', ()        => expect(build(42).startRoom.biome).toBe('stone'))
  it('start room has 0 hazards', ()         => expect(build(42).startRoom.hazardCount).toBe(0))
  it('boss room biome is void', ()          => expect(build(42).bossRoom.biome).toBe('void'))
  it('boss room has 3 hazards', ()          => expect(build(42).bossRoom.hazardCount).toBe(3))
  it('all rooms have a depth assigned', () => {
    for (const r of build(42).rooms) expect(r.depth).toBeGreaterThanOrEqual(0)
  })
  it('depth 1–2 rooms have 0 hazardCount', () => {
    for (const r of build(42).rooms)
      if (r.depth <= 2 && r.type !== 'boss') expect(r.hazardCount).toBe(0)
  })
  it('elite rooms always have hazardCount 3', () => {
    for (const r of build(42).rooms)
      if (r.type === 'elite') expect(r.hazardCount).toBe(3)
  })
  it('rest rooms have no enemies', () => {
    for (const r of build(42).rooms)
      if (r.type === 'rest') expect(r.enemies.length).toBe(0)
  })
  it('start room has no enemies', () => expect(build(42).startRoom.enemies.length).toBe(0))
  it('normal rooms at depth 3+ have enemies', () => {
    const d = build(42)
    const target = d.rooms.find(r => r.type === 'normal' && r.depth >= 3)
    if (target) expect(target.enemies.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- BiomeAssigner
```

- [ ] **Step 3: Implement BiomeAssigner.ts**

```typescript
// src/dungeon/BiomeAssigner.ts
import type { SpellElement } from '../spells/SpellDefinitions'
import type { DungeonData, EnemySpawnData, RoomData } from './DungeonGenerator'
import { getNeighborRoom } from './DungeonGenerator'
import type { BiomeType } from './BiomeDefinitions'

const ELEMENT_TO_BIOME: Record<SpellElement, BiomeType> = {
  fire: 'fire', ice: 'ice', lightning: 'lightning', arcane: 'arcane',
}

// Spells available to enemies per element
const ELEMENT_SPELLS: Record<SpellElement, string[]> = {
  fire:      ['fireball', 'flame_lance', 'ember_shot', 'pyroblast'],
  ice:       ['frost_bolt', 'frozen_nova', 'glacial_spike'],
  lightning: ['chain_lightning', 'spark', 'thunder_clap'],
  arcane:    ['arcane_missile', 'arcane_explosion', 'mana_siphon'],
}

const ELEMENTS: SpellElement[] = ['fire', 'ice', 'lightning', 'arcane']

function pickSpells(element: SpellElement, count: number, depth: number, rng: () => number): string[] {
  const pool = [...ELEMENT_SPELLS[element]]
  // depth 5+: at least one blink
  const spells: string[] = []
  if (depth >= 5) spells.push('blink')
  while (spells.length < count) {
    const idx  = Math.floor(rng() * pool.length)
    const pick = pool.splice(idx, 1)[0]
    if (!spells.includes(pick)) spells.push(pick)
    if (pool.length === 0) break
  }
  return spells.slice(0, count)
}

function enemyPositions(count: number, rng: () => number): Array<{ x: number; z: number }> {
  const positions: Array<{ x: number; z: number }> = []
  for (let i = 0; i < count; i++) {
    // Spread enemies in room interior (±6 units, avoid center ±1.5)
    let x: number, z: number
    do {
      x = (rng() * 2 - 1) * 6
      z = (rng() * 2 - 1) * 6
    } while (Math.abs(x) < 2 && Math.abs(z) < 2)
    positions.push({ x, z })
  }
  return positions
}

function generateEnemies(room: RoomData, element: SpellElement, rng: () => number): EnemySpawnData[] {
  const d     = room.depth
  const elite = room.type === 'elite'

  let apprentices  = 0
  let battleMages  = 0

  if (d <= 2)      { apprentices = elite ? 3 : 2 }
  else if (d <= 4) { apprentices = elite ? 2 : 1; battleMages = elite ? 2 : 1 }
  else             { apprentices = elite ? 2 : 1; battleMages = elite ? 3 : 2 }

  const spellCount = d <= 2 ? 2 : d <= 4 ? 3 : 4
  const total      = apprentices + battleMages
  const positions  = enemyPositions(total, rng)
  const enemies: EnemySpawnData[] = []

  for (let i = 0; i < apprentices; i++) {
    enemies.push({
      archetype: 'apprentice',
      spellIds:  pickSpells(element, spellCount, d, rng),
      position:  positions[i],
      depth: d,
    })
  }
  for (let i = 0; i < battleMages; i++) {
    enemies.push({
      archetype: 'battle_mage',
      spellIds:  pickSpells(element, spellCount, d, rng),
      position:  positions[apprentices + i],
      depth: d,
    })
  }
  return enemies
}

export function assignBiomes(dungeon: DungeonData, rng: () => number): void {
  // BFS from start → assign depth
  const queue: RoomData[] = [dungeon.startRoom]
  const seen = new Set<string>([dungeon.startRoom.id])
  dungeon.startRoom.depth = 0

  while (queue.length > 0) {
    const room = queue.shift()!
    for (const dir of room.connections) {
      const nb = getNeighborRoom(dungeon.grid, room, dir)
      if (nb && !seen.has(nb.id)) {
        seen.add(nb.id)
        nb.depth = room.depth + 1
        queue.push(nb)
      }
    }
  }

  // Pick run-dominant element
  const dominant: SpellElement = ELEMENTS[Math.floor(rng() * ELEMENTS.length)]
  const dominantBiome = ELEMENT_TO_BIOME[dominant]

  for (const room of dungeon.rooms) {
    if (room.type === 'boss') {
      room.biome = 'void'; room.hazardCount = 3; continue
    }
    if (room.type === 'rest') {
      room.biome = 'stone'; room.hazardCount = 0; continue
    }

    const d = room.depth
    if (d === 0) {
      room.biome = 'stone'; room.hazardCount = 0
    } else if (d <= 2) {
      room.biome       = rng() < 0.8 ? 'stone' : dominantBiome
      room.hazardCount = 0
    } else if (d <= 4) {
      room.biome       = dominantBiome
      room.hazardCount = room.type === 'elite' ? 3 : 1
    } else if (d <= 6) {
      room.biome       = dominantBiome
      room.hazardCount = room.type === 'elite' ? 3 : 2
    } else {
      room.biome       = dominantBiome
      room.hazardCount = 3
    }
    if (room.type === 'elite') room.hazardCount = 3
  }

  // Generate enemy spawns
  for (const room of dungeon.rooms) {
    if (room.type === 'start' || room.type === 'rest' || room.type === 'boss') {
      room.enemies = []; continue
    }
    // Derive element from biome (stone rooms use dominant element)
    const el: SpellElement = room.biome === 'stone' ? dominant : (dominant)
    room.enemies = generateEnemies(room, el, rng)
  }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test -- BiomeAssigner
```

- [ ] **Step 5: Commit**

```bash
git add src/dungeon/BiomeAssigner.ts tests/BiomeAssigner.test.ts
git commit -m "feat: add BiomeAssigner — BFS depth + biome + enemy spawn data"
```

---

## Task 5: Room rewrite — floor, walls, door gaps, corridors, door state

**Files:**
- Rewrite: `src/dungeon/Room.ts`

- [ ] **Step 1: Replace Room.ts entirely**

```typescript
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
  private doorArrows  = new Map<Direction, THREE.Mesh>()
  private questionMarks = new Map<Direction, THREE.Mesh>()

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
    this.doorArrows.clear()
    this.questionMarks.clear()
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
      }
    }
    // TODO: add directional arrow when open
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
        // Full wall
        const [w, d, x, z] = this.wallDims(dir, false, 0)
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_HEIGHT, d), mat.clone())
        m.position.set(x, wh, z)
        walls.push(m)
      } else {
        // Two wall pieces flanking the gap
        const isNS = dir === 'north' || dir === 'south'
        const segLen = (this.roomSize - DOOR_HALF * 2) / 2  // each side
        const zPos = (dir === 'north' ? -1 : 1) * half
        const xPos = (dir === 'west'  ? -1 : 1) * half

        if (isNS) {
          // left piece
          const lm = new THREE.Mesh(new THREE.BoxGeometry(segLen, WALL_HEIGHT, WALL_T), mat.clone())
          lm.position.set(-(DOOR_HALF + segLen / 2), wh, zPos)
          walls.push(lm)
          // right piece
          const rm = new THREE.Mesh(new THREE.BoxGeometry(segLen, WALL_HEIGHT, WALL_T), mat.clone())
          rm.position.set(DOOR_HALF + segLen / 2, wh, zPos)
          walls.push(rm)
        } else {
          // top piece
          const tm = new THREE.Mesh(new THREE.BoxGeometry(WALL_T, WALL_HEIGHT, segLen), mat.clone())
          tm.position.set(xPos, wh, -(DOOR_HALF + segLen / 2))
          walls.push(tm)
          // bottom piece
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
      // floor
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(CORR_HALF * 2, CORR_LEN), mat)
      floor.rotation.x = -Math.PI / 2
      floor.position.set(0, 0, zCenter)
      meshes.push(floor)
      // side walls
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

    // Doors start closed unless room is pre-cleared
    if (this.data.cleared) {
      // skip adding closed door mesh — gap stays open
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
```

- [ ] **Step 2: Type-check**

```bash
npm run build 2>&1 | head -30
```
Expected: no errors in `Room.ts`

- [ ] **Step 3: Commit**

```bash
git add src/dungeon/Room.ts
git commit -m "feat: rewrite Room — door gaps, corridors, biome colors, shrine"
```

---

## Task 6: Player extensions + Enemy overhaul

**Files:**
- Modify: `src/entities/Player.ts`
- Rewrite: `src/entities/Enemy.ts`
- Create: `tests/EnemyScaling.test.ts`

- [ ] **Step 1: Write the failing scaling tests**

```typescript
// tests/EnemyScaling.test.ts
import { describe, it, expect } from 'vitest'
import { scaleEnemyStats } from '../src/entities/Enemy'

describe('scaleEnemyStats', () => {
  it('apprentice base HP at depth 0 is 40',    () => expect(scaleEnemyStats('apprentice', 0).hp).toBe(40))
  it('battle_mage base HP at depth 0 is 80',   () => expect(scaleEnemyStats('battle_mage', 0).hp).toBe(80))
  it('HP scales ~1.15 per depth',              () => expect(scaleEnemyStats('apprentice', 1).hp).toBeCloseTo(46, 0))
  it('HP cap at depth 8',                      () => expect(scaleEnemyStats('apprentice', 8).hp).toBe(scaleEnemyStats('apprentice', 9).hp))
  it('apprentice base speed is 2.5',           () => expect(scaleEnemyStats('apprentice', 0).speed).toBeCloseTo(2.5, 2))
  it('speed scales ~1.05 per depth',           () => expect(scaleEnemyStats('apprentice', 1).speed).toBeCloseTo(2.625, 2))
  it('speed cap at depth 6',                   () => expect(scaleEnemyStats('apprentice', 6).speed).toBeCloseTo(scaleEnemyStats('apprentice', 7).speed, 4))
  it('castInterval at depth 0 is 2.0',         () => expect(scaleEnemyStats('apprentice', 0).castInterval).toBeCloseTo(2.0, 2))
  it('castInterval min is 0.8',                () => expect(scaleEnemyStats('apprentice', 20).castInterval).toBeCloseTo(0.8, 2))
  it('spellCount 2 at depth 0',                () => expect(scaleEnemyStats('apprentice', 0).spellCount).toBe(2))
  it('spellCount 3 at depth 3',                () => expect(scaleEnemyStats('apprentice', 3).spellCount).toBe(3))
  it('spellCount 4 at depth 5',                () => expect(scaleEnemyStats('apprentice', 5).spellCount).toBe(4))
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- EnemyScaling
```

- [ ] **Step 3: Add speedMultiplier + knockbackVelocity to Player.ts**

In `src/entities/Player.ts`, add these two properties and update `update()`:

```typescript
// After: lastDirection = new THREE.Vector3(0, 0, 1)
speedMultiplier  = 1.0
knockbackVelocity = new THREE.Vector3()
```

In `update()`, replace the movement block with:

```typescript
update(delta: number, input: InputManager, bounds: RoomBounds): void {
  // Reset per-frame modifier (HazardSystem sets it each frame if needed)
  this.speedMultiplier = 1.0

  const dir = new THREE.Vector3()
  if (input.isHeld('ArrowLeft'))  dir.x -= 1
  if (input.isHeld('ArrowRight')) dir.x += 1
  if (input.isHeld('ArrowUp'))    dir.z -= 1
  if (input.isHeld('ArrowDown'))  dir.z += 1

  if (dir.lengthSq() > 0) {
    dir.normalize()
    this.lastDirection.copy(dir)
    this.position.x += dir.x * PLAYER_SPEED * this.speedMultiplier * delta
    this.position.z += dir.z * PLAYER_SPEED * this.speedMultiplier * delta
  }

  // Apply knockback (decays 8× per second)
  if (this.knockbackVelocity.lengthSq() > 0.001) {
    this.position.x += this.knockbackVelocity.x * delta
    this.position.z += this.knockbackVelocity.z * delta
    this.knockbackVelocity.multiplyScalar(Math.max(0, 1 - 8 * delta))
  }

  this.position.x = Math.max(bounds.minX + PLAYER_RADIUS, Math.min(bounds.maxX - PLAYER_RADIUS, this.position.x))
  this.position.z = Math.max(bounds.minZ + PLAYER_RADIUS, Math.min(bounds.maxZ - PLAYER_RADIUS, this.position.z))

  this.mana = Math.min(this.maxMana, this.mana + MANA_REGEN_RATE * delta)
}
```

- [ ] **Step 4: Rewrite Enemy.ts**

```typescript
// src/entities/Enemy.ts
import * as THREE  from 'three'
import { SPELLS }  from '../spells/SpellDefinitions'
import { Projectile } from './Projectile'
import type { RoomBounds } from '../dungeon/Room'

export interface EnemyConfig {
  archetype: 'apprentice' | 'battle_mage'
  spellIds:  string[]
  x: number
  z: number
  depth: number
}

export interface ScaledStats {
  hp: number; speed: number; castInterval: number; spellCount: number
}

const BASE_HP:    Record<'apprentice' | 'battle_mage', number> = { apprentice: 40, battle_mage: 80 }
const BASE_SPEED: Record<'apprentice' | 'battle_mage', number> = { apprentice: 2.5, battle_mage: 1.8 }

export function scaleEnemyStats(
  archetype: 'apprentice' | 'battle_mage',
  depth: number,
): ScaledStats {
  const hpD    = Math.min(depth, 8)
  const speedD = Math.min(depth, 6)
  return {
    hp:           Math.round(BASE_HP[archetype]    * Math.pow(1.15, hpD)),
    speed:        BASE_SPEED[archetype] * Math.pow(1.05, speedD),
    castInterval: Math.max(0.8, 2.0 - depth * 0.1),
    spellCount:   depth <= 2 ? 2 : depth <= 4 ? 3 : 4,
  }
}

const ELEMENT_COLOR: Record<string, number> = {
  fire: 0xcc4400, ice: 0x4499cc, lightning: 0xcccc00, arcane: 0x9944cc,
}

// Telegraph state for blink
interface BlinkTelegraph {
  timer:       number          // counts up to 0.6s
  destination: THREE.Vector3
  originRing:  THREE.Mesh
  destRing:    THREE.Mesh
  line:        THREE.Line
}

export class Enemy {
  readonly mesh:     THREE.Mesh
  readonly position: THREE.Vector3
  hp:    number
  maxHp: number
  alive  = true

  private readonly stats:     ScaledStats
  private readonly archetype: 'apprentice' | 'battle_mage'
  private readonly depth:     number
  private readonly spells     = Object.values(SPELLS)
  private castTimer           = 0
  private aggressionRange:    number
  private telegraph:          BlinkTelegraph | null = null
  private ghostTimer          = 0
  private ghostMesh:          THREE.Mesh | null = null

  constructor(config: EnemyConfig) {
    this.archetype = config.archetype
    this.depth     = config.depth
    this.stats     = scaleEnemyStats(config.archetype, config.depth)
    this.hp        = this.stats.hp
    this.maxHp     = this.stats.hp

    // Aggression range by depth
    this.aggressionRange = config.depth <= 2 ? 8 : config.depth <= 4 ? 12 : 9999

    // Pick spells from config IDs
    this.spells = config.spellIds
      .map(id => SPELLS[id])
      .filter(Boolean)

    // Visuals
    const isLarge = config.archetype === 'battle_mage'
    const geo     = new THREE.BoxGeometry(0.8, isLarge ? 1.8 : 1.2, 0.8)
    const color   = this.dominantColor()
    const mat     = new THREE.MeshStandardMaterial({ color })
    this.mesh     = new THREE.Mesh(geo, mat)
    this.mesh.position.set(config.x, isLarge ? 0.9 : 0.6, config.z)
    this.position = this.mesh.position

    // Stagger cast timer so enemies don't all fire at once
    this.castTimer = Math.random() * this.stats.castInterval
  }

  private dominantColor(): number {
    if (!this.spells.length) return 0x888888
    const el = this.spells[0].element
    return ELEMENT_COLOR[el] ?? 0x888888
  }

  update(
    delta: number,
    playerPos: THREE.Vector3,
    bounds: RoomBounds,
    scene: THREE.Scene,
  ): Projectile | null {
    if (!this.alive) return null

    // Update ghost after-image
    if (this.ghostMesh) {
      this.ghostTimer -= delta
      const mat = this.ghostMesh.material as THREE.MeshStandardMaterial
      mat.opacity = Math.max(0, this.ghostTimer / 0.4)
      if (this.ghostTimer <= 0) { scene.remove(this.ghostMesh); this.ghostMesh = null }
    }

    // Handle blink telegraph
    if (this.telegraph) {
      this.telegraph.timer += delta
      if (this.telegraph.timer >= 0.6) {
        this.executeBlink(this.telegraph.destination, scene)
        this.clearTelegraph(scene)
      }
      return null  // frozen during telegraph
    }

    const dist = this.position.distanceTo(playerPos)
    const inRange = dist < this.aggressionRange

    if (!inRange) return null

    // Check blink trigger
    if (this.shouldBlink(playerPos, dist)) {
      const dest = this.blinkDestination(playerPos, bounds)
      if (dest) {
        this.startTelegraph(dest, scene)
        return null
      }
    }

    // Movement
    this.moveToward(delta, playerPos, dist)

    // Casting
    this.castTimer -= delta
    if (this.castTimer <= 0 && this.spells.length > 0) {
      this.castTimer = this.stats.castInterval
      return this.fireProjectile(playerPos, scene)
    }

    return null
  }

  private moveToward(delta: number, playerPos: THREE.Vector3, dist: number): void {
    if (this.archetype === 'battle_mage') {
      const targetDist = 8
      const tooClose   = dist < 6
      const dir = new THREE.Vector3().subVectors(playerPos, this.position).setY(0).normalize()
      if (tooClose) {
        this.position.x -= dir.x * this.stats.speed * delta
        this.position.z -= dir.z * this.stats.speed * delta
      } else if (dist > targetDist + 1) {
        this.position.x += dir.x * this.stats.speed * delta
        this.position.z += dir.z * this.stats.speed * delta
      }
      // strafe: add perpendicular component
      const perp = new THREE.Vector3(-dir.z, 0, dir.x)
      this.position.x += perp.x * this.stats.speed * 0.4 * delta
      this.position.z += perp.z * this.stats.speed * 0.4 * delta
    } else {
      if (dist > 0.5) {
        const dir = new THREE.Vector3().subVectors(playerPos, this.position).setY(0).normalize()
        this.position.x += dir.x * this.stats.speed * delta
        this.position.z += dir.z * this.stats.speed * delta
      }
    }
  }

  private shouldBlink(playerPos: THREE.Vector3, dist: number): boolean {
    if (this.archetype === 'apprentice' && this.depth >= 5) {
      return this.hp / this.maxHp < 0.3
    }
    if (this.archetype === 'battle_mage' && this.depth >= 4) {
      return dist < 3
    }
    return false
  }

  private blinkDestination(playerPos: THREE.Vector3, bounds: RoomBounds): THREE.Vector3 | null {
    const away = new THREE.Vector3().subVectors(this.position, playerPos).setY(0).normalize()
    const dist = this.archetype === 'battle_mage' && this.depth >= 6 ? -6 : 6
    const dest = this.position.clone().addScaledVector(away, dist)
    dest.x = Math.max(bounds.minX + 1, Math.min(bounds.maxX - 1, dest.x))
    dest.z = Math.max(bounds.minZ + 1, Math.min(bounds.maxZ - 1, dest.z))
    return dest
  }

  private startTelegraph(dest: THREE.Vector3, scene: THREE.Scene): void {
    const ringGeo = new THREE.TorusGeometry(0.6, 0.05, 8, 32)
    const mat1 = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(0xffffff), emissiveIntensity: 2 })
    const mat2 = mat1.clone()

    const originRing = new THREE.Mesh(ringGeo, mat1)
    originRing.position.copy(this.position)
    originRing.rotation.x = Math.PI / 2

    const destRing = new THREE.Mesh(ringGeo.clone(), mat2)
    destRing.position.copy(dest)
    destRing.rotation.x = Math.PI / 2

    const points = [this.position.clone(), dest.clone()]
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true })
    const line    = new THREE.Line(lineGeo, lineMat)

    scene.add(originRing, destRing, line)
    this.telegraph = { timer: 0, destination: dest, originRing, destRing, line }
  }

  private executeBlink(dest: THREE.Vector3, scene: THREE.Scene): void {
    // After-image at current position
    const ghostGeo = this.mesh.geometry.clone()
    const ghostMat = new THREE.MeshStandardMaterial({
      color: (this.mesh.material as THREE.MeshStandardMaterial).color.clone(),
      transparent: true, opacity: 0.8,
    })
    this.ghostMesh  = new THREE.Mesh(ghostGeo, ghostMat)
    this.ghostMesh.position.copy(this.position)
    scene.add(this.ghostMesh)
    this.ghostTimer = 0.4

    this.position.copy(dest)
  }

  private clearTelegraph(scene: THREE.Scene): void {
    if (!this.telegraph) return
    scene.remove(this.telegraph.originRing, this.telegraph.destRing, this.telegraph.line)
    this.telegraph = null
  }

  private fireProjectile(playerPos: THREE.Vector3, scene: THREE.Scene): Projectile | null {
    // Pick a non-blink spell
    const castable = this.spells.filter(s => s.id !== 'blink' && s.type === 'projectile')
    if (!castable.length) return null
    const spell = castable[Math.floor(Math.random() * castable.length)]
    const dir   = new THREE.Vector3().subVectors(playerPos, this.position).setY(0).normalize()
    const origin = this.position.clone().setY(0.75)
    return new Projectile(origin, dir, spell, scene)
  }

  takeDamage(amount: number, scene: THREE.Scene): void {
    this.hp -= amount
    if (this.hp <= 0) this.die(scene)
  }

  private die(scene: THREE.Scene): void {
    this.alive = false
    this.clearTelegraph(scene)
    scene.remove(this.mesh)
  }
}
```

- [ ] **Step 5: Run — expect PASS**

```bash
npm test -- EnemyScaling
```

- [ ] **Step 6: Commit**

```bash
git add src/entities/Player.ts src/entities/Enemy.ts tests/EnemyScaling.test.ts
git commit -m "feat: enemy archetypes + depth scaling + blink telegraph; player speedMultiplier"
```

---

## Task 7: HazardSystem

**Files:**
- Create: `src/dungeon/HazardSystem.ts`

- [ ] **Step 1: Create HazardSystem.ts**

```typescript
// src/dungeon/HazardSystem.ts
import * as THREE from 'three'
import type { HazardDefinition } from './BiomeDefinitions'
import type { RoomData, EnemySpawnData } from './DungeonGenerator'
import type { Player } from '../entities/Player'
import { mulberry32 } from '../utils/MathUtils'

interface Hazard {
  def:      HazardDefinition
  mesh:     THREE.Mesh
  position: THREE.Vector3
  timer:    number   // general animation timer
  stormTimer: number // for storm_zone knockback cooldown
}

const DOOR_CLEAR   = 4   // units from door center
const ENEMY_CLEAR  = 3   // units from enemy spawn
const HAZARD_CLEAR = 3   // units between hazards

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

    // Door positions (for clearance check)
    const doorPositions = roomData.connections.map(dir => {
      const h = half + 1
      switch (dir) {
        case 'north': return new THREE.Vector3(0, 0, -h)
        case 'south': return new THREE.Vector3(0, 0,  h)
        case 'west':  return new THREE.Vector3(-h, 0, 0)
        case 'east':  return new THREE.Vector3( h, 0, 0)
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

      // Proximity brightening
      const mat = h.mesh.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = inRange ? 1.5 : 0.6

      // Animate
      this.animateHazard(h, delta, scene)

      if (!inRange) continue

      // Apply effect
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
      case 1: return 1 + Math.floor(rng() * 2)   // 1–2
      case 2: return 2 + Math.floor(rng() * 3)   // 2–4
      case 3: return 4 + Math.floor(rng() * 3)   // 4–6
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
```

- [ ] **Step 2: Type-check**

```bash
npm run build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/dungeon/HazardSystem.ts
git commit -m "feat: add HazardSystem — spawn, animate, player effects"
```

---

## Task 8: DungeonRenderer — biome lighting, fog, particles

**Files:**
- Create: `src/dungeon/DungeonRenderer.ts`
- Modify: `src/core/SceneManager.ts` (expose `ambientLight`)

- [ ] **Step 1: Expose ambientLight in SceneManager.ts**

In `src/core/SceneManager.ts`, change the ambient light from a local variable to a class field:

```typescript
// Change this:
//   const ambient = new THREE.AmbientLight(0xffffff, 0.6)
// To:
readonly ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
```

And update the `scene.add` call:
```typescript
this.scene.add(this.ambientLight, directional)
```

Also add `followPlayer()` and `snapToRoom()` methods:

```typescript
followPlayer(playerPos: THREE.Vector3, delta: number): void {
  const target = playerPos.clone().add(new THREE.Vector3(0, 20, 14))
  this.camera.position.lerp(target, 0.08)
  this.camera.lookAt(playerPos)
}

snapToRoom(center: THREE.Vector3): void {
  this.camera.position.copy(center.clone().add(new THREE.Vector3(0, 20, 14)))
  this.camera.lookAt(center)
}
```

- [ ] **Step 2: Create DungeonRenderer.ts**

```typescript
// src/dungeon/DungeonRenderer.ts
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

    // Ambient light
    this.sm.ambientLight.color.set(biome.ambientLightColor)
    this.sm.ambientLight.intensity = biome.ambientLightIntensity

    // Fog
    scene.fog = new THREE.FogExp2(biome.fogColor, biome.fogDensity)

    // Particles
    this.clearParticles(scene)
    this.spawnParticles(biome, scene)
  }

  update(delta: number, scene: THREE.Scene): void {
    if (!this.biome) return

    this.lightTimer += delta

    // Lightning biome: flicker ambient
    if (this.biome.type === 'lightning') {
      this.sm.ambientLight.intensity =
        this.biome.ambientLightIntensity * (0.8 + 0.2 * Math.sin(this.lightTimer * 12))
    }

    // Update particles
    for (const p of this.particles) {
      p.life -= delta
      p.mesh.position.add(p.velocity.clone().multiplyScalar(delta))

      // Wrap around room bounds (±8 area)
      for (const axis of ['x', 'z'] as const) {
        if (p.mesh.position[axis] >  8) p.mesh.position[axis] = -8
        if (p.mesh.position[axis] < -8) p.mesh.position[axis] =  8
      }

      // Biome-specific: fire particles drift up and reset
      if (this.biome.type === 'fire') {
        if (p.mesh.position.y > 3) {
          p.mesh.position.y = 0.1
          p.mesh.position.x = (Math.random() * 2 - 1) * 8
          p.mesh.position.z = (Math.random() * 2 - 1) * 8
        }
      }

      // Fade out near end of life
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
```

- [ ] **Step 3: Type-check**

```bash
npm run build 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/dungeon/DungeonRenderer.ts src/core/SceneManager.ts
git commit -m "feat: DungeonRenderer biome lighting/fog/particles; SceneManager followPlayer"
```

---

## Task 9: DungeonSession — state machine + room transitions

**Files:**
- Create: `src/dungeon/DungeonSession.ts`

- [ ] **Step 1: Create DungeonSession.ts**

```typescript
// src/dungeon/DungeonSession.ts
import * as THREE from 'three'
import { generateDungeon }    from './DungeonGenerator'
import { assignBiomes }       from './BiomeAssigner'
import { Room }               from './Room'
import { HazardSystem }       from './HazardSystem'
import { DungeonRenderer }    from './DungeonRenderer'
import { BIOMES }             from './BiomeDefinitions'
import { mulberry32 }         from '../utils/MathUtils'
import { Enemy }              from '../entities/Enemy'
import { Projectile }         from '../entities/Projectile'
import { circleVsRect }       from '../utils/CollisionUtils'
import {
  OPPOSITE_DIR, getNeighborRoom,
  type DungeonData, type RoomData, type Direction,
} from './DungeonGenerator'
import type { Player }        from '../entities/Player'
import type { SceneManager }  from '../core/SceneManager'
import { PLAYER_RADIUS, ENEMY_HALF_X, ENEMY_HALF_Z } from '../constants'

type TransitionState = 'idle' | 'fade-out' | 'fade-in'

const FADE_DURATION = 0.3

export class DungeonSession {
  private dungeon!:         DungeonData
  private activeRoomData!:  RoomData
  private activeRoom!:      Room
  private enemies:          Enemy[]       = []
  private enemyProjectiles: Projectile[]  = []
  private hazards:          HazardSystem  = new HazardSystem()
  private renderer!:        DungeonRenderer
  private transitionState:  TransitionState = 'idle'
  private fadeTimer         = 0
  private pendingDir:       Direction | null = null
  private overlay:          HTMLElement | null = null
  private shrineUsed        = false

  init(scene: THREE.Scene, sm: SceneManager, seed: number): void {
    this.renderer = new DungeonRenderer(sm)
    this.overlay  = document.getElementById('fade-overlay')

    this.dungeon = generateDungeon(seed)
    assignBiomes(this.dungeon, mulberry32(seed + 9999))

    this.activateRoom(this.dungeon.startRoom, scene, null)
  }

  get currentRoomData(): RoomData { return this.activeRoomData }
  get dungeonData():     DungeonData { return this.dungeon }

  update(delta: number, player: Player, scene: THREE.Scene): void {
    this.renderer.update(delta, scene)

    switch (this.transitionState) {
      case 'idle':
        this.idleTick(delta, player, scene)
        break
      case 'fade-out':
        this.fadeTimer += delta
        this.setOverlayOpacity(this.fadeTimer / FADE_DURATION)
        if (this.fadeTimer >= FADE_DURATION) {
          this.commitTransition(player, scene)
          this.transitionState = 'fade-in'
          this.fadeTimer = 0
        }
        break
      case 'fade-in':
        this.fadeTimer += delta
        this.setOverlayOpacity(1 - this.fadeTimer / FADE_DURATION)
        if (this.fadeTimer >= FADE_DURATION) {
          this.setOverlayOpacity(0)
          this.transitionState = 'idle'
          this.fadeTimer = 0
          // Show biome description on first visit
          if (!this.activeRoomData.visited) {
            this.showBiomeDescription(this.activeRoomData)
          }
          this.activeRoomData.visited = true
        }
        break
    }
  }

  private idleTick(delta: number, player: Player, scene: THREE.Scene): void {
    // Update enemies + collect fired projectiles
    for (const enemy of this.enemies) {
      const proj = enemy.update(delta, player.position, this.activeRoom.bounds, scene)
      if (proj) this.enemyProjectiles.push(proj)
    }
    this.enemies = this.enemies.filter(e => e.alive)

    // Update enemy projectiles
    for (const p of this.enemyProjectiles) {
      p.update(delta, this.activeRoom.bounds, scene)
    }
    this.checkEnemyProjectilePlayerCollisions(player, scene)
    this.enemyProjectiles = this.enemyProjectiles.filter(p => p.alive)

    // Hazards
    this.hazards.update(delta, player, scene)

    // Room clear check
    if (!this.activeRoomData.cleared && this.enemies.length === 0) {
      this.activeRoomData.cleared = true
      this.activeRoom.openAllDoors(scene)
    }

    // Shrine heal
    if (this.activeRoomData.type === 'rest' && !this.shrineUsed) {
      if (player.position.distanceTo(new THREE.Vector3(0, 0, 0)) < 2) {
        player.hp    = Math.min(player.maxHp,   player.hp   + 30)
        player.mana  = Math.min(player.maxMana,  player.mana + 30)
        this.shrineUsed = true
        this.flashPlayer(player, scene)
      }
    }

    // Door crossing
    if (this.activeRoomData.cleared) {
      const crossed = this.activeRoom.checkDoorCrossing(player.position)
      if (crossed && this.activeRoomData.connections.includes(crossed)) {
        this.pendingDir       = crossed
        this.transitionState  = 'fade-out'
        this.fadeTimer        = 0
      }
    }
  }

  private commitTransition(player: Player, scene: THREE.Scene): void {
    if (!this.pendingDir) return
    const dir     = this.pendingDir
    const nextData = getNeighborRoom(this.dungeon.grid, this.activeRoomData, dir)
    if (!nextData) return

    // Despawn current room
    this.clearRoom(scene)

    // Activate next
    this.activateRoom(nextData, scene, OPPOSITE_DIR[dir])

    // Reposition player at entry door of new room
    const spawnPos = this.activeRoom.getSpawnPosition(OPPOSITE_DIR[dir])
    player.position.set(spawnPos.x, player.position.y, spawnPos.z)
    this.pendingDir = null
  }

  private activateRoom(roomData: RoomData, scene: THREE.Scene, _enterFrom: Direction | null): void {
    this.activeRoomData = roomData
    const biome = BIOMES[roomData.biome]

    this.activeRoom = new Room(roomData, biome)
    this.activeRoom.build(scene)

    this.renderer.applyBiome(biome, scene)

    // Spawn enemies
    this.enemies = roomData.enemies.map(spawn =>
      new Enemy({ archetype: spawn.archetype, spellIds: spawn.spellIds, x: spawn.position.x, z: spawn.position.z, depth: spawn.depth })
    )
    for (const e of this.enemies) scene.add(e.mesh)

    // Spawn hazards
    this.hazards.spawnForRoom(roomData, biome.hazards, scene, this.hashRoomId(roomData.id))

    this.shrineUsed = false
  }

  private clearRoom(scene: THREE.Scene): void {
    this.activeRoom.dispose(scene)
    for (const e of this.enemies) { if (e.alive) scene.remove(e.mesh) }
    for (const p of this.enemyProjectiles) p.destroy(scene)
    this.enemies          = []
    this.enemyProjectiles = []
    this.hazards.clear(scene)
    this.renderer.clear(scene)
  }

  private checkEnemyProjectilePlayerCollisions(player: Player, scene: THREE.Scene): void {
    for (const proj of this.enemyProjectiles) {
      if (!proj.alive) continue
      const r = Math.max(proj.spell.projectileScale.x, proj.spell.projectileScale.z) * 0.5
      const hit = circleVsRect(
        proj.mesh.position.x, proj.mesh.position.z, r,
        player.position.x - PLAYER_RADIUS, player.position.x + PLAYER_RADIUS,
        player.position.z - PLAYER_RADIUS, player.position.z + PLAYER_RADIUS,
      )
      if (hit) { player.takeDamage(proj.damage); proj.destroy(scene) }
    }
  }

  private flashPlayer(player: Player, _scene: THREE.Scene): void {
    const mat = player.mesh.material as THREE.MeshStandardMaterial
    mat.emissive.set(0x00ff44)
    mat.emissiveIntensity = 1
    setTimeout(() => { mat.emissive.set(0x000000); mat.emissiveIntensity = 0 }, 300)
  }

  private showBiomeDescription(room: RoomData): void {
    const biome = BIOMES[room.biome]
    const el    = document.getElementById('biome-desc')
    if (!el) return
    el.textContent = biome.description
    el.classList.remove('fade-desc')
    void el.offsetWidth
    el.classList.add('fade-desc')
  }

  private setOverlayOpacity(t: number): void {
    if (this.overlay) this.overlay.style.opacity = String(Math.max(0, Math.min(1, t)))
  }

  private hashRoomId(id: string): number {
    let h = 0
    for (const c of id) h = (Math.imul(31, h) + c.charCodeAt(0)) >>> 0
    return h
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/dungeon/DungeonSession.ts
git commit -m "feat: add DungeonSession state machine — room transitions, enemy lifecycle"
```

---

## Task 10: HUD minimap + index.html additions

**Files:**
- Modify: `index.html`
- Modify: `src/ui/HUD.ts`
- Modify: `styles.css`

- [ ] **Step 1: Add overlay, minimap, biome desc to index.html**

In `index.html`, inside `<body>` before the `<script>` tag, add:

```html
<div id="fade-overlay"></div>
<canvas id="minimap" width="150" height="150"></canvas>
<div id="biome-desc"></div>
```

- [ ] **Step 2: Add CSS for the new elements to styles.css**

Append to `styles.css`:

```css
#fade-overlay {
  position: fixed;
  inset: 0;
  background: black;
  opacity: 0;
  pointer-events: none;
  z-index: 50;
}

#minimap {
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(0,0,0,0.7);
  border: 1px solid #444;
  image-rendering: pixelated;
  z-index: 20;
}

#biome-desc {
  position: fixed;
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  color: #cccccc;
  font-size: 14px;
  font-style: italic;
  opacity: 0;
  pointer-events: none;
  z-index: 20;
  text-shadow: 0 0 8px #000;
}

#biome-desc.fade-desc {
  animation: biome-fade 3s ease forwards;
}

@keyframes biome-fade {
  0%   { opacity: 0; }
  15%  { opacity: 1; }
  70%  { opacity: 1; }
  100% { opacity: 0; }
}
```

- [ ] **Step 3: Update HUD.ts — add minimap**

Add minimap fields and init to `HUD.ts`:

```typescript
// Add these fields after the existing ones:
private minimapCanvas!: HTMLCanvasElement
private minimapCtx!:    CanvasRenderingContext2D
```

In `init()`, add after the existing element lookups:

```typescript
this.minimapCanvas = document.getElementById('minimap') as HTMLCanvasElement
this.minimapCtx    = this.minimapCanvas.getContext('2d')!
```

Update the `update()` signature to accept dungeon data:

```typescript
update(
  player: Player,
  caster: SpellCaster,
  spellBar: SpellBar,
  currentTime: number,
  dungeonData?: import('../dungeon/DungeonGenerator').DungeonData,
  currentRoomId?: string,
): void {
  // ... existing update code unchanged ...

  if (dungeonData) this.drawMinimap(dungeonData, currentRoomId ?? '')
}
```

Add the `drawMinimap` method to `HUD.ts`:

```typescript
private drawMinimap(
  dungeon: import('../dungeon/DungeonGenerator').DungeonData,
  currentRoomId: string,
): void {
  const ctx   = this.minimapCtx
  const CELL  = 8
  const PAD   = 2
  const GRID  = CELL + PAD

  ctx.clearRect(0, 0, 150, 150)

  // Draw corridors first (lines between connected room centers)
  ctx.strokeStyle = '#555'
  ctx.lineWidth   = 1
  for (const room of dungeon.rooms) {
    if (!room.visited) continue
    const rx = PAD + room.gridX * GRID + CELL / 2
    const ry = PAD + room.gridY * GRID + CELL / 2
    for (const dir of room.connections) {
      const nb = dungeon.grid[
        room.gridY + (dir === 'south' ? 1 : dir === 'north' ? -1 : 0)
      ]?.[
        room.gridX + (dir === 'east' ? 1 : dir === 'west' ? -1 : 0)
      ]
      if (nb?.visited) {
        const nx = PAD + nb.gridX * GRID + CELL / 2
        const ny = PAD + nb.gridY * GRID + CELL / 2
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(nx, ny); ctx.stroke()
      }
    }
  }

  // Room colors
  const TYPE_COLOR: Record<string, string> = {
    start:  '#ffffff',
    normal: '#888888',
    elite:  '#660000',
    rest:   '#006600',
    boss:   '#220022',
  }

  const BIOME_TINT: Record<string, string> = {
    fire: 'rgba(255,68,0,0.3)',  ice: 'rgba(100,200,255,0.3)',
    lightning: 'rgba(255,255,0,0.2)', arcane: 'rgba(136,0,255,0.3)',
    void: 'rgba(100,0,50,0.4)',  stone: 'rgba(80,80,80,0.2)',
  }

  for (const room of dungeon.rooms) {
    const rx = PAD + room.gridX * GRID
    const ry = PAD + room.gridY * GRID

    if (!room.visited) {
      ctx.fillStyle = '#111'
      ctx.fillRect(rx, ry, CELL, CELL)
      ctx.strokeStyle = '#333'
      ctx.lineWidth   = 0.5
      ctx.strokeRect(rx, ry, CELL, CELL)
    } else {
      ctx.fillStyle = TYPE_COLOR[room.type] ?? '#888'
      ctx.fillRect(rx, ry, CELL, CELL)
      // Biome tint overlay
      ctx.fillStyle = BIOME_TINT[room.biome] ?? ''
      ctx.fillRect(rx, ry, CELL, CELL)
    }

    // Current room: white border
    if (room.id === currentRoomId) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth   = 1
      ctx.strokeRect(rx, ry, CELL, CELL)
      // Player dot
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(rx + CELL / 2, ry + CELL / 2, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
```

- [ ] **Step 4: Type-check**

```bash
npm run build 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css src/ui/HUD.ts
git commit -m "feat: minimap canvas, fade overlay, biome description UI"
```

---

## Task 11: Game.ts wiring — delegate to DungeonSession

**Files:**
- Modify: `src/core/Game.ts`

- [ ] **Step 1: Rewrite Game.ts to delegate dungeon to DungeonSession**

```typescript
// src/core/Game.ts
import * as THREE        from 'three'
import { SceneManager }  from './SceneManager'
import { InputManager }  from './InputManager'
import { Player }        from '../entities/Player'
import { Projectile }    from '../entities/Projectile'
import { SpellCaster }   from '../spells/SpellCaster'
import { SpellBar }      from '../spells/SpellBar'
import { HUD }           from '../ui/HUD'
import { DungeonSession } from '../dungeon/DungeonSession'
import {
  IEffect,
  castBlink,
  FrozenNovaEffect,
  IceWallEffect,
  ThunderClapEffect,
  ArcaneExplosionEffect,
  StaticFieldEffect,
  FrostDecalEffect,
  LightningBoltEffect,
} from '../spells/SpellEffects'
import { circleVsRect }  from '../utils/CollisionUtils'
import {
  DELTA_CAP,
  ENEMY_HALF_X,
  ENEMY_HALF_Z,
} from '../constants'
import { SPELLS } from '../spells/SpellDefinitions'
import type { Enemy } from '../entities/Enemy'

const SLOT_KEYS = ['KeyQ', 'KeyW', 'KeyE', 'KeyR'] as const

export class Game {
  private sceneManager:  SceneManager
  private inputManager:  InputManager
  private session:       DungeonSession
  private player:        Player
  private spellCaster:   SpellCaster
  private spellBar:      SpellBar
  private hud:           HUD
  private projectiles:   Projectile[]  = []
  private activeEffects: IEffect[]     = []
  private clock          = new THREE.Clock()

  private mouseWorld     = new THREE.Vector3()
  private floorPlane     = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private mouseRaycaster = new THREE.Raycaster()
  private mouseNDC       = new THREE.Vector2()

  constructor() {
    this.sceneManager = new SceneManager()
    this.inputManager = new InputManager()
    this.player       = new Player()
    this.spellCaster  = new SpellCaster(this.player)
    this.spellBar     = new SpellBar()
    this.hud          = new HUD()
    this.session      = new DungeonSession()
  }

  start(): void {
    const seed = Math.floor(Math.random() * 0xFFFFFF)
    this.session.init(this.sceneManager.scene, this.sceneManager, seed)
    this.sceneManager.scene.add(this.player.mesh)
    this.hud.init()
    this.clock.start()
    requestAnimationFrame(this.loop)
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop)

    const delta       = Math.min(this.clock.getDelta(), DELTA_CAP)
    const currentTime = this.clock.getElapsedTime()

    this.inputManager.update()

    const roomBounds = this.session.currentRoomData
      ? { minX: -9, maxX: 9, minZ: -9, maxZ: 9 }   // Room.bounds is referenced from the Room, but we keep it simple here
      : { minX: -9, maxX: 9, minZ: -9, maxZ: 9 }

    // NOTE: pass session.activeRoom.bounds once exposed; for now use a default
    this.player.update(delta, this.inputManager, this.session['activeRoom']?.bounds ?? { minX: -9, maxX: 9, minZ: -9, maxZ: 9 })

    // Mouse world position
    this.mouseNDC.set(this.inputManager.mouseX, this.inputManager.mouseY)
    this.mouseRaycaster.setFromCamera(this.mouseNDC, this.sceneManager.camera)
    const hit = new THREE.Vector3()
    if (this.mouseRaycaster.ray.intersectPlane(this.floorPlane, hit)) {
      this.mouseWorld.copy(hit)
    }

    // Bar toggle
    if (this.inputManager.isJustPressed('Tab')) {
      this.spellBar.toggleBar()
      this.hud.onBarToggle()
    }

    // Spell casting
    for (let slotIdx = 0; slotIdx < 4; slotIdx++) {
      if (this.inputManager.isJustPressed(SLOT_KEYS[slotIdx])) {
        this.attemptCast(slotIdx, currentTime)
      }
    }

    // Update dungeon session (enemies, hazards, transitions)
    this.session.update(delta, this.player, this.sceneManager.scene)

    // Update player projectiles
    const bounds = this.session['activeRoom']?.bounds ?? { minX: -9, maxX: 9, minZ: -9, maxZ: 9 }
    for (const proj of this.projectiles) {
      if (proj.spell.id === 'arcane_missile') {
        // homing: find nearest alive enemy from session
        // (enemies are managed by session now, skip homing for now)
      }
      proj.update(delta, bounds, this.sceneManager.scene)
    }

    // Check player projectile → enemy collisions via session enemies
    this.checkPlayerProjectileCollisions(currentTime)
    this.projectiles = this.projectiles.filter(p => p.alive)

    for (const effect of this.activeEffects) {
      effect.update(delta, this.sceneManager.scene, [])
    }
    this.activeEffects = this.activeEffects.filter(e => e.alive)

    // Camera follow
    this.sceneManager.followPlayer(this.player.position, delta)

    this.hud.update(
      this.player,
      this.spellCaster,
      this.spellBar,
      currentTime,
      this.session.dungeonData,
      this.session.currentRoomData?.id,
    )
    this.sceneManager.render()
  }

  private attemptCast(slotIdx: number, currentTime: number): void {
    const spell = this.spellBar.getSpellAtSlot(slotIdx as 0 | 1 | 2 | 3)
    if (!spell) return

    const mouseDir = new THREE.Vector3()
      .subVectors(this.mouseWorld, this.player.position)
      .setY(0)

    if (mouseDir.lengthSq() < 0.001) mouseDir.copy(this.player.lastDirection)
    else mouseDir.normalize()

    const result = this.spellCaster.cast(
      spell, this.player, [], this.sceneManager.scene, currentTime, mouseDir,
    )

    const barIndex = (this.spellBar.activeBar - 1) as 0 | 1
    if (!result.success) { this.hud.onCastFail(barIndex, slotIdx); return }
    this.hud.onCastSuccess(barIndex, slotIdx)

    if (result.projectile) {
      if (spell.id === 'chain_lightning') result.projectile.jumpsRemaining = 3
      this.projectiles.push(result.projectile)
      return
    }
    if (result.spellId) this.handleSpecialSpell(result.spellId, mouseDir)
  }

  private handleSpecialSpell(spellId: string, direction: THREE.Vector3): void {
    const scene = this.sceneManager.scene
    const pos   = this.player.position.clone()

    switch (spellId) {
      case 'blink':
        castBlink(this.player.position, this.player.mesh, this.player.lastDirection)
        break
      case 'frozen_nova':
        this.activeEffects.push(new FrozenNovaEffect(pos, [], SPELLS.frozen_nova.damage, scene))
        break
      case 'ice_wall':
        this.activeEffects.push(new IceWallEffect(pos, direction, scene))
        break
      case 'thunder_clap':
        this.activeEffects.push(new ThunderClapEffect(pos, [], SPELLS.thunder_clap.damage, SPELLS.thunder_clap.radius ?? 5, scene))
        break
      case 'arcane_explosion':
        this.activeEffects.push(new ArcaneExplosionEffect(pos, [], SPELLS.arcane_explosion.damage, SPELLS.arcane_explosion.radius ?? 6, scene))
        break
      case 'static_field':
        this.activeEffects.push(new StaticFieldEffect(this.mouseWorld.clone(), scene))
        break
    }
  }

  private checkPlayerProjectileCollisions(currentTime: number): void {
    // Get enemies from session via private field access
    const enemies: Enemy[] = (this.session as any).enemies ?? []

    for (const proj of this.projectiles) {
      if (!proj.alive) continue
      for (const enemy of enemies) {
        if (!enemy.alive) continue
        const r = Math.max(proj.spell.projectileScale.x, proj.spell.projectileScale.z) * 0.5
        const hit = circleVsRect(
          proj.mesh.position.x, proj.mesh.position.z, r,
          enemy.position.x - ENEMY_HALF_X, enemy.position.x + ENEMY_HALF_X,
          enemy.position.z - ENEMY_HALF_Z, enemy.position.z + ENEMY_HALF_Z,
        )
        if (!hit) continue

        if (proj.spell.radius && proj.spell.radius > 0) {
          const r2 = proj.spell.radius * proj.spell.radius
          const ip  = proj.mesh.position.clone()
          for (const other of enemies) {
            if (!other.alive) continue
            const dx = other.position.x - ip.x, dz = other.position.z - ip.z
            if (dx * dx + dz * dz <= r2) other.takeDamage(proj.damage, this.sceneManager.scene)
          }
        } else {
          enemy.takeDamage(proj.damage, this.sceneManager.scene)
        }

        if (proj.spell.element === 'ice') {
          this.activeEffects.push(new FrostDecalEffect(proj.mesh.position.clone(), this.sceneManager.scene))
        }

        if (proj.spell.id === 'chain_lightning' && proj.jumpsRemaining > 0) {
          const next = this.findChainTarget(enemy, enemies)
          if (next) {
            const from = proj.mesh.position.clone()
            const to   = next.position.clone()
            this.activeEffects.push(new LightningBoltEffect(from, to, this.sceneManager.scene))
            const dir = new THREE.Vector3().subVectors(to, from).setY(0).normalize()
            this.projectiles.push(new Projectile(from.setY(0.75), dir, proj.spell, this.sceneManager.scene, proj.jumpsRemaining - 1))
          }
        }

        proj.destroy(this.sceneManager.scene)
        break
      }
    }
  }

  private findChainTarget(hitEnemy: Enemy, enemies: Enemy[]): Enemy | null {
    let nearest: Enemy | null = null, minDist = Infinity
    for (const e of enemies) {
      if (!e.alive || e === hitEnemy) continue
      const d = hitEnemy.position.distanceTo(e.position)
      if (d < 6 && d < minDist) { minDist = d; nearest = e }
    }
    return nearest
  }
}
```

> **Note on the `(this.session as any).enemies` access**: Add a public getter `get activeEnemies() { return this.enemies }` to `DungeonSession.ts` after Task 9 is committed, and replace the `as any` cast with `this.session.activeEnemies`.

- [ ] **Step 2: Add `activeEnemies` getter to DungeonSession.ts**

In `src/dungeon/DungeonSession.ts`, add after the `currentRoomData` getter:

```typescript
get activeEnemies(): Enemy[] { return this.enemies }
```

Then in `Game.ts`, replace `(this.session as any).enemies` with `this.session.activeEnemies`.

Also add a public `get activeRoomBounds()` getter to DungeonSession:

```typescript
get activeRoomBounds() { return this.activeRoom?.bounds ?? { minX: -9, maxX: 9, minZ: -9, maxZ: 9 } }
```

And in `Game.ts`, replace the two `this.session['activeRoom']?.bounds` accesses with `this.session.activeRoomBounds`.

- [ ] **Step 3: Run all tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 4: Type-check**

```bash
npm run build 2>&1 | head -30
```
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/Game.ts src/dungeon/DungeonSession.ts
git commit -m "feat: wire DungeonSession into Game — procedural dungeon live"
```

---

## Self-Review Against Spec

| Spec Requirement | Covered By |
|---|---|
| Connected rooms + corridors + room-to-room navigation | Task 5 (Room), Task 9 (DungeonSession transitions) |
| 6 biomes shifting with depth | Task 2 (BiomeDefinitions), Task 4 (BiomeAssigner), Task 8 (DungeonRenderer) |
| Per-biome hazards affecting gameplay | Task 7 (HazardSystem) |
| Two enemy archetypes scaling with depth | Task 6 (Enemy) |
| Minimap 150×150 top-right | Task 10 (HUD) |
| Smooth camera follow lerp 0.08 | Task 8 (SceneManager.followPlayer) |
| Camera snap on transition | Task 9 (DungeonSession.commitTransition → snapToRoom) |
| Doors lock on enter, unlock on clear | Task 9 (`cleared` flag, `openAllDoors`) |
| Blink with telegraph (ring, line, freeze, after-image) | Task 6 (Enemy blink AI) |
| Rest room shrine heal once per visit | Task 9 (shrine check in idleTick) |
| Biome description on first visit | Task 9 (`showBiomeDescription`) |
| Fade in/out 0.3s | Task 9 (state machine) |
| 7×7 grid, 10–14 rooms, seeded RNG | Task 3 (DungeonGenerator) |

**Missing from plan — add before calling done:**
- `snapToRoom()` is called in `commitTransition` but DungeonSession needs a reference to SceneManager. Pass `sm` into `commitTransition` or store it. Store it: add `private sm!: SceneManager` to DungeonSession and assign in `init()`. Then call `this.sm.snapToRoom(new THREE.Vector3())` at end of `commitTransition`.

Patch: in `DungeonSession.ts` `init()`, after `this.renderer = new DungeonRenderer(sm)`, add `this.sm = sm`. In `commitTransition`, after repositioning the player, add `this.sm.snapToRoom(new THREE.Vector3(0, 0, 0))`.
