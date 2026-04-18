import { describe, it, expect } from 'vitest'
import { SpellBar } from '../src/spells/SpellBar'
import { SPELLS } from '../src/spells/SpellDefinitions'

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

  it('bar 1 slot 0 defaults to fireball', () => {
    expect(new SpellBar().getSpellAtSlot(0)?.id).toBe('fireball')
  })

  it('bar 1 slot 1 defaults to frost_bolt', () => {
    expect(new SpellBar().getSpellAtSlot(1)?.id).toBe('frost_bolt')
  })

  it('bar 1 slot 2 defaults to chain_lightning', () => {
    expect(new SpellBar().getSpellAtSlot(2)?.id).toBe('chain_lightning')
  })

  it('bar 1 slot 3 defaults to arcane_missile', () => {
    expect(new SpellBar().getSpellAtSlot(3)?.id).toBe('arcane_missile')
  })

  it('bar 2 slot 0 defaults to ember_shot after toggle', () => {
    const bar = new SpellBar()
    bar.toggleBar()
    expect(bar.getSpellAtSlot(0)?.id).toBe('ember_shot')
  })

  it('bar 2 slot 1 defaults to glacial_spike after toggle', () => {
    const bar = new SpellBar()
    bar.toggleBar()
    expect(bar.getSpellAtSlot(1)?.id).toBe('glacial_spike')
  })

  it('bar 2 slot 2 defaults to spark after toggle', () => {
    const bar = new SpellBar()
    bar.toggleBar()
    expect(bar.getSpellAtSlot(2)?.id).toBe('spark')
  })

  it('bar 2 slot 3 defaults to blink after toggle', () => {
    const bar = new SpellBar()
    bar.toggleBar()
    expect(bar.getSpellAtSlot(3)?.id).toBe('blink')
  })

  it('assignSpell updates the specified bar slot', () => {
    const bar = new SpellBar()
    bar.assignSpell(1, 0, SPELLS.spark)
    expect(bar.getSpellAtSlot(0)?.id).toBe('spark')
  })
})
