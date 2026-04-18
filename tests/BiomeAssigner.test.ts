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
