import { describe, it, expect } from 'vitest'
import { SpellBar } from '../src/spells/SpellBar'
import { SPELLS } from '../src/spells/SpellDefinitions'
import type { ActiveLoadout } from '../src/progression/PlayerInventory'

const DEFAULT_LOADOUT: ActiveLoadout = {
  bar1: ['fireball', 'frost_bolt', 'chain_lightning', 'arcane_missile'],
  bar2: ['ember_shot', 'glacial_spike', 'spark', 'blink'],
}

describe('SpellBar', () => {
  it('starts on bar 1', () => {
    expect(new SpellBar().activeBar).toBe(1)
  })

  it('toggleBar switches to bar 2', () => {
    const bar = new SpellBar()
    bar.toggleBar()
    expect(bar.activeBar).toBe(2)
  })

  it('toggleBar back to bar 1', () => {
    const bar = new SpellBar()
    bar.toggleBar()
    bar.toggleBar()
    expect(bar.activeBar).toBe(1)
  })

  it('getActiveBar returns 4 slots', () => {
    expect(new SpellBar().getActiveBar().length).toBe(4)
  })

  it('starts empty — slots are null before loadFromLoadout', () => {
    expect(new SpellBar().getSpellAtSlot(0)).toBeNull()
  })

  it('bar 1 slot 0 is fireball after loadFromLoadout', () => {
    const bar = new SpellBar()
    bar.loadFromLoadout(DEFAULT_LOADOUT)
    expect(bar.getSpellAtSlot(0)?.id).toBe('fireball')
  })

  it('bar 1 slot 1 is frost_bolt after loadFromLoadout', () => {
    const bar = new SpellBar()
    bar.loadFromLoadout(DEFAULT_LOADOUT)
    expect(bar.getSpellAtSlot(1)?.id).toBe('frost_bolt')
  })

  it('bar 1 slot 2 is chain_lightning after loadFromLoadout', () => {
    const bar = new SpellBar()
    bar.loadFromLoadout(DEFAULT_LOADOUT)
    expect(bar.getSpellAtSlot(2)?.id).toBe('chain_lightning')
  })

  it('bar 1 slot 3 is arcane_missile after loadFromLoadout', () => {
    const bar = new SpellBar()
    bar.loadFromLoadout(DEFAULT_LOADOUT)
    expect(bar.getSpellAtSlot(3)?.id).toBe('arcane_missile')
  })

  it('bar 2 slot 0 is ember_shot after loadFromLoadout + toggle', () => {
    const bar = new SpellBar()
    bar.loadFromLoadout(DEFAULT_LOADOUT)
    bar.toggleBar()
    expect(bar.getSpellAtSlot(0)?.id).toBe('ember_shot')
  })

  it('bar 2 slot 1 is glacial_spike after loadFromLoadout + toggle', () => {
    const bar = new SpellBar()
    bar.loadFromLoadout(DEFAULT_LOADOUT)
    bar.toggleBar()
    expect(bar.getSpellAtSlot(1)?.id).toBe('glacial_spike')
  })

  it('bar 2 slot 2 is spark after loadFromLoadout + toggle', () => {
    const bar = new SpellBar()
    bar.loadFromLoadout(DEFAULT_LOADOUT)
    bar.toggleBar()
    expect(bar.getSpellAtSlot(2)?.id).toBe('spark')
  })

  it('bar 2 slot 3 is blink after loadFromLoadout + toggle', () => {
    const bar = new SpellBar()
    bar.loadFromLoadout(DEFAULT_LOADOUT)
    bar.toggleBar()
    expect(bar.getSpellAtSlot(3)?.id).toBe('blink')
  })

  it('assignSpell updates the specified bar slot', () => {
    const bar = new SpellBar()
    bar.assignSpell(1, 0, SPELLS.spark)
    expect(bar.getSpellAtSlot(0)?.id).toBe('spark')
  })
})
