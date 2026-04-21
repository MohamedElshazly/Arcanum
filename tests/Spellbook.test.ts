import { describe, it, expect, beforeEach } from 'vitest'
import { Spellbook } from '../src/ui/Spellbook'

function mockInventory(pool: string[] = ['fireball', 'frost_bolt', 'spark', 'arcane_missile']) {
  return {
    spellPool: pool,
    activeLoadout: { bar1: [null, null, null, null], bar2: [null, null, null, null] },
    ownsSpell: (id: string) => pool.includes(id),
    addToPool: (id: string) => { if (!pool.includes(id)) pool.push(id) },
    assignSpell: () => {},
    removeSpellFromLoadout: () => {},
    save: () => {},
  } as any
}

describe('Spellbook', () => {
  let root: HTMLElement

  beforeEach(() => {
    root = document.createElement('div')
  })

  it('player book renders with data-owner="player"', () => {
    const sb = new Spellbook({
      root,
      owner: 'player',
      spells: ['fireball', 'frost_bolt'],
      inventory: mockInventory(),
      onConfirm: () => {},
    })
    sb.show()
    const overlay = root.querySelector('.spellbook-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay!.getAttribute('data-owner')).toBe('player')
    sb.dispose()
  })

  it('enemy book renders with data-owner="enemy"', () => {
    const sb = new Spellbook({
      root,
      owner: 'enemy',
      spells: ['fireball', 'frost_bolt'],
      inventory: mockInventory(),
      onConfirm: () => {},
    })
    sb.show()
    const overlay = root.querySelector('.spellbook-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay!.getAttribute('data-owner')).toBe('enemy')
    sb.dispose()
  })

  it('player book has 5 element tabs (All, Fire, Ice, Lightning, Arcane)', () => {
    const sb = new Spellbook({
      root,
      owner: 'player',
      spells: ['fireball'],
      inventory: mockInventory(),
      onConfirm: () => {},
    })
    sb.show()
    const tabs = root.querySelectorAll('.spellbook-tab')
    expect(tabs.length).toBe(5)
    const labels = Array.from(tabs).map(t => t.textContent)
    expect(labels).toEqual(['All', 'Fire', 'Ice', 'Lightning', 'Arcane'])
    sb.dispose()
  })

  it('enemy book has 0 tabs', () => {
    const sb = new Spellbook({
      root,
      owner: 'enemy',
      spells: ['fireball'],
      inventory: mockInventory(),
      onConfirm: () => {},
    })
    sb.show()
    const tabs = root.querySelectorAll('.spellbook-tab')
    expect(tabs.length).toBe(0)
    sb.dispose()
  })

  it('spell cards render for available spells', () => {
    const spells = ['fireball', 'frost_bolt', 'spark']
    const sb = new Spellbook({
      root,
      owner: 'player',
      spells,
      inventory: mockInventory(),
      onConfirm: () => {},
    })
    sb.show()
    const cards = root.querySelectorAll('.spellbook-spell-card')
    expect(cards.length).toBe(spells.length)
    const ids = Array.from(cards).map(c => c.getAttribute('data-spell-id'))
    expect(ids).toEqual(spells)
    sb.dispose()
  })

  it('player book has 8 loadout slots', () => {
    const sb = new Spellbook({
      root,
      owner: 'player',
      spells: ['fireball'],
      inventory: mockInventory(),
      onConfirm: () => {},
    })
    sb.show()
    const slots = root.querySelectorAll('.spellbook-loadout-slot')
    expect(slots.length).toBe(8)
    sb.dispose()
  })

  it('enemy book has 3 claim slots (default maxPicks)', () => {
    const sb = new Spellbook({
      root,
      owner: 'enemy',
      spells: ['fireball', 'frost_bolt', 'spark'],
      inventory: mockInventory(),
      onConfirm: () => {},
    })
    sb.show()
    const slots = root.querySelectorAll('.spellbook-claim-slot')
    expect(slots.length).toBe(3)
    sb.dispose()
  })

  it('dispose() clears root innerHTML', () => {
    const sb = new Spellbook({
      root,
      owner: 'player',
      spells: ['fireball'],
      inventory: mockInventory(),
      onConfirm: () => {},
    })
    sb.show()
    expect(root.innerHTML).not.toBe('')
    sb.dispose()
    expect(root.innerHTML).toBe('')
  })
})
