import { describe, it, expect } from 'vitest'
import {
  generateDungeon, getNeighborRoom, OPPOSITE_DIR,
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
    const sameCount  = a.rooms.length   === b.rooms.length
    const sameStart  = a.startRoom.id   === b.startRoom.id
    expect(sameCount && sameStart).toBe(false)
  })
})
