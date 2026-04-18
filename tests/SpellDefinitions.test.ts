import { describe, it, expect } from 'vitest'
import { SPELLS } from '../src/spells/SpellDefinitions'

const ALL_IDS = [
  'fireball', 'flame_lance', 'ember_shot', 'pyroblast',
  'frost_bolt', 'ice_wall', 'frozen_nova', 'glacial_spike',
  'chain_lightning', 'thunder_clap', 'spark', 'static_field',
  'arcane_missile', 'blink', 'mana_siphon', 'arcane_explosion',
]

describe('SpellDefinitions', () => {
  it('defines exactly 16 spells', () => {
    expect(Object.keys(SPELLS).length).toBe(16)
  })

  it.each(ALL_IDS)('spell %s has base fields', (id) => {
    const s = SPELLS[id]
    expect(s).toBeDefined()
    expect(s.id).toBe(id)
    expect(s.name).toBeTruthy()
    expect(['fire', 'ice', 'lightning', 'arcane']).toContain(s.element)
    expect(['projectile', 'aoe', 'beam', 'self']).toContain(s.type)
    expect(s.manaCost).toBeGreaterThanOrEqual(0)
    expect(s.cooldown).toBeGreaterThan(0)
  })

  it.each(ALL_IDS)('spell %s has visual metadata', (id) => {
    const s = SPELLS[id]
    expect(s.projectileGeometry).toMatch(/^(sphere|cone|cylinder|ring|spike)$/)
    expect(s.projectileScale).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      z: expect.any(Number),
    })
    expect(s.color).toMatch(/^#/)
    expect(s.emissiveColor).toMatch(/^#/)
    expect(s.emissiveIntensity).toBeGreaterThan(0)
  })
})
