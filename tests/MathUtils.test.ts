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
