import { describe, it, expect } from 'vitest'
import { RunData } from '../src/progression/RunData'

describe('RunData', () => {
  it('records collected books with spell arrays', () => {
    const rd = new RunData()
    rd.recordBookCollected(['fireball', 'ember_shot'])
    rd.recordBookCollected(['frost_bolt', 'fireball'])
    expect(rd.collectedBooks.length).toBe(2)
  })

  it('returns deduped spell pool from all collected books', () => {
    const rd = new RunData()
    rd.recordBookCollected(['fireball', 'ember_shot'])
    rd.recordBookCollected(['frost_bolt', 'fireball'])
    const pool = rd.getCollectedSpellPool()
    expect(pool).toContain('fireball')
    expect(pool).toContain('ember_shot')
    expect(pool).toContain('frost_bolt')
    expect(pool.length).toBe(3)
  })

  it('provides flat compat list via booksCollectedThisRun', () => {
    const rd = new RunData()
    rd.recordBookCollected(['fireball', 'ember_shot'])
    rd.recordBookCollected(['frost_bolt'])
    expect(rd.booksCollectedThisRun).toEqual(['fireball', 'ember_shot', 'frost_bolt'])
  })

  it('resets collected books on reset', () => {
    const rd = new RunData()
    rd.recordBookCollected(['fireball'])
    rd.reset()
    expect(rd.collectedBooks.length).toBe(0)
    expect(rd.getCollectedSpellPool().length).toBe(0)
  })
})
