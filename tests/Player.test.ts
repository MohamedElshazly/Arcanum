import { describe, it, expect } from 'vitest'
import { MANA_REGEN_RATE } from '../src/constants'

describe('Player mana', () => {
  it('regenerates at 8 MP per second', () => {
    expect(MANA_REGEN_RATE).toBe(8)
  })
})
