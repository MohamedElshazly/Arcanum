import { Spell, SPELLS } from './SpellDefinitions'
import type { ActiveLoadout } from '../progression/PlayerInventory'

export class SpellBar {
  bar1: (Spell | null)[] = [null, null, null, null]
  bar2: (Spell | null)[] = [null, null, null, null]
  activeBar: 1 | 2 = 1

  loadFromLoadout(loadout: ActiveLoadout): void {
    this.bar1 = loadout.bar1.map(id => (id ? SPELLS[id] ?? null : null))
    this.bar2 = loadout.bar2.map(id => (id ? SPELLS[id] ?? null : null))
  }

  getActiveBar(): (Spell | null)[] {
    return this.activeBar === 1 ? this.bar1 : this.bar2
  }

  getSpellAtSlot(slot: 0 | 1 | 2 | 3): Spell | null {
    return this.getActiveBar()[slot] ?? null
  }

  toggleBar(): void {
    this.activeBar = this.activeBar === 1 ? 2 : 1
  }

  assignSpell(bar: 1 | 2, slot: number, spell: Spell | null): void {
    if (bar === 1) this.bar1[slot] = spell
    else this.bar2[slot] = spell
  }
}
