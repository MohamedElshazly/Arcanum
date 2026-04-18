import { describe, it, expect } from 'vitest'
import { circleVsRect, isOutOfBounds } from '../src/utils/CollisionUtils'
import type { RoomBounds } from '../src/dungeon/Room'

describe('circleVsRect', () => {
  it('returns true when circle center is inside rect', () => {
    expect(circleVsRect(0, 0, 0.5, -1, 1, -1, 1)).toBe(true)
  })

  it('returns true when circle edge exactly touches rect edge', () => {
    // circle center at (1.5, 0), radius 0.5 — right edge at x=1.5, touching rect maxX=1
    expect(circleVsRect(1.5, 0, 0.5, -1, 1, -1, 1)).toBe(true)
  })

  it('returns false when circle is outside and not touching', () => {
    expect(circleVsRect(3, 0, 0.5, -1, 1, -1, 1)).toBe(false)
  })

  it('returns true when circle overlaps corner of rect', () => {
    // nearest point on rect to (1.3, 1.3) is (1, 1); distance = sqrt(0.18) ≈ 0.424 < 0.5
    expect(circleVsRect(1.3, 1.3, 0.5, -1, 1, -1, 1)).toBe(true)
  })

  it('returns false when circle misses corner of rect', () => {
    // nearest point on rect to (1.5, 1.5) is (1, 1); distance = sqrt(0.5) ≈ 0.707 > 0.5
    expect(circleVsRect(1.5, 1.5, 0.5, -1, 1, -1, 1)).toBe(false)
  })
})

describe('isOutOfBounds', () => {
  const bounds: RoomBounds = { minX: -9, maxX: 9, minZ: -9, maxZ: 9 }

  it('returns false for a point inside bounds', () => {
    expect(isOutOfBounds(0, 0, bounds)).toBe(false)
  })

  it('returns true for a point past maxX', () => {
    expect(isOutOfBounds(10, 0, bounds)).toBe(true)
  })

  it('returns true for a point past minZ', () => {
    expect(isOutOfBounds(0, -10, bounds)).toBe(true)
  })

  it('returns false on the exact boundary', () => {
    expect(isOutOfBounds(9, 9, bounds)).toBe(false)
  })
})
