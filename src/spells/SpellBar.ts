import { Spell, SPELLS } from './SpellDefinitions'

export class SpellBar {
  bar1: (Spell | null)[] = [
    SPELLS.fireball,
    SPELLS.frost_bolt,
    SPELLS.chain_lightning,
    SPELLS.arcane_missile,
  ]
  bar2: (Spell | null)[] = [
    SPELLS.ember_shot,
    SPELLS.glacial_spike,
    SPELLS.spark,
    SPELLS.blink,
  ]
  activeBar: 1 | 2 = 1

  getActiveBar(): (Spell | null)[] {
    return this.activeBar === 1 ? this.bar1 : this.bar2
  }

  getSpellAtSlot(slot: 0 | 1 | 2 | 3): Spell | null {
    return this.getActiveBar()[slot] ?? null
  }

  toggleBar(): void {
    this.activeBar = this.activeBar === 1 ? 2 : 1
  }

  assignSpell(bar: 1 | 2, slot: number, spell: Spell): void {
    if (bar === 1) this.bar1[slot] = spell
    else this.bar2[slot] = spell
  }
}
