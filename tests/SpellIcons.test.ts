import { describe, it, expect } from 'vitest'
import { getSpellIcon, ELEMENT_COLORS } from '../src/ui/SpellIcons'

describe('SpellIcons', () => {
  it('returns an SVG string for every known spell', () => {
    const knownSpells = [
      'fireball', 'flame_lance', 'ember_shot', 'pyroblast',
      'frost_bolt', 'ice_wall', 'frozen_nova', 'glacial_spike',
      'chain_lightning', 'thunder_clap', 'spark', 'static_field',
      'arcane_missile', 'blink', 'mana_siphon', 'arcane_explosion',
    ]
    for (const id of knownSpells) {
      const svg = getSpellIcon(id)
      expect(svg).toContain('<svg')
      expect(svg).toContain('</svg>')
    }
  })

  it('returns a fallback icon for unknown spells', () => {
    const svg = getSpellIcon('unknown_spell')
    expect(svg).toContain('<svg')
  })

  it('exports element colors', () => {
    expect(ELEMENT_COLORS.fire).toBe('#ff6600')
    expect(ELEMENT_COLORS.ice).toBe('#44aaff')
    expect(ELEMENT_COLORS.lightning).toBe('#ffff44')
    expect(ELEMENT_COLORS.arcane).toBe('#bb44ff')
  })
})
