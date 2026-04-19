import { Spellbook } from './Spellbook'
import { SPELLS }    from '../spells/SpellDefinitions'
import type { PlayerInventory } from '../progression/PlayerInventory'
import type { MasterySystem }   from '../progression/MasterySystem'
import type { Grimoire }        from '../progression/Grimoire'

export interface LoadoutScreenConfig {
  root:           HTMLDivElement
  inventory:      PlayerInventory
  mastery:        MasterySystem
  grimoire:       Grimoire
  onEnterDungeon: () => void
}

export class LoadoutScreen {
  private config: LoadoutScreenConfig
  private spellbook: Spellbook | null = null

  constructor(config: LoadoutScreenConfig) {
    this.config = config
  }

  show(): void {
    const allSpellIds = Object.keys(SPELLS)

    this.spellbook = new Spellbook({
      root: this.config.root,
      owner: 'player',
      spells: allSpellIds,
      inventory: this.config.inventory,
      mastery: this.config.mastery,
      grimoire: this.config.grimoire,
      onConfirm: () => this.config.onEnterDungeon(),
    })
    this.spellbook.show()
  }

  dispose(): void {
    if (this.spellbook) {
      this.spellbook.dispose()
      this.spellbook = null
    }
  }
}
