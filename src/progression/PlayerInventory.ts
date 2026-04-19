import { SPELLS } from '../spells/SpellDefinitions'
import type { Spell } from '../spells/SpellDefinitions'

export interface ActiveLoadout {
  bar1: (string | null)[]
  bar2: (string | null)[]
}

const STORAGE_KEY_POOL    = 'spell_pool'
const STORAGE_KEY_LOADOUT = 'active_loadout'

const DEFAULT_POOL: string[] = [
  'fireball', 'frost_bolt', 'spark', 'arcane_missile',
]

const DEFAULT_LOADOUT: ActiveLoadout = {
  bar1: ['fireball', 'frost_bolt', 'spark', 'arcane_missile'],
  bar2: [null, null, null, null],
}

export class PlayerInventory {
  private pool: string[]        = []
  private loadout: ActiveLoadout = { bar1: [null,null,null,null], bar2: [null,null,null,null] }

  load(): void {
    const rawPool    = localStorage.getItem(STORAGE_KEY_POOL)
    const rawLoadout = localStorage.getItem(STORAGE_KEY_LOADOUT)

    if (!rawPool) {
      this.pool    = [...DEFAULT_POOL]
      this.loadout = JSON.parse(JSON.stringify(DEFAULT_LOADOUT))
      this.save()
    } else {
      this.pool = JSON.parse(rawPool) as string[]
      this.loadout = rawLoadout
        ? JSON.parse(rawLoadout) as ActiveLoadout
        : JSON.parse(JSON.stringify(DEFAULT_LOADOUT))
    }
  }

  save(): void {
    localStorage.setItem(STORAGE_KEY_POOL,    JSON.stringify(this.pool))
    localStorage.setItem(STORAGE_KEY_LOADOUT, JSON.stringify(this.loadout))
  }

  get spellPool(): readonly string[] { return this.pool }
  get activeLoadout(): ActiveLoadout { return this.loadout }

  ownsSpell(spellId: string): boolean { return this.pool.includes(spellId) }

  addToPool(spellId: string): void {
    if (!this.pool.includes(spellId)) {
      this.pool.push(spellId)
      this.save()
    }
  }

  assignSpell(bar: 1 | 2, slot: 0 | 1 | 2 | 3, spellId: string | null): void {
    const key = bar === 1 ? 'bar1' : 'bar2'
    this.loadout[key][slot] = spellId
    this.save()
  }

  removeSpellFromLoadout(spellId: string): void {
    for (const bar of ['bar1', 'bar2'] as const) {
      for (let i = 0; i < 4; i++) {
        if (this.loadout[bar][i] === spellId) {
          this.loadout[bar][i] = null
        }
      }
    }
    this.save()
  }

  replaceInLoadout(oldId: string, newId: string): void {
    for (const bar of ['bar1', 'bar2'] as const) {
      for (let i = 0; i < 4; i++) {
        if (this.loadout[bar][i] === oldId) {
          this.loadout[bar][i] = newId
        }
      }
    }
    this.save()
  }

  hasAnySpellAssigned(): boolean {
    return [...this.loadout.bar1, ...this.loadout.bar2].some(id => id !== null)
  }

  resolveBar(bar: 1 | 2): (Spell | null)[] {
    const key = bar === 1 ? 'bar1' : 'bar2'
    return this.loadout[key].map(id => (id ? SPELLS[id] ?? null : null))
  }
}
