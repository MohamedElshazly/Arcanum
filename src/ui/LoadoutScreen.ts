import { Spellbook } from './Spellbook'
import { SPELLS }    from '../spells/SpellDefinitions'
import type { PlayerInventory } from '../progression/PlayerInventory'
import type { MasterySystem }   from '../progression/MasterySystem'
import type { Grimoire }        from '../progression/Grimoire'
import type { DifficultySystem } from '../progression/DifficultySystem'
import type { Audio }            from '../audio'

export interface LoadoutScreenConfig {
  root:           HTMLDivElement
  inventory:      PlayerInventory
  mastery:        MasterySystem
  grimoire:       Grimoire
  difficulty:     DifficultySystem
  audio?:         Audio
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
      root:       this.config.root,
      owner:      'player',
      spells:     allSpellIds,
      inventory:  this.config.inventory,
      mastery:    this.config.mastery,
      grimoire:   this.config.grimoire,
      audio:      this.config.audio,
      difficulty: this.config.difficulty,
      onConfirm:  () => this.config.onEnterDungeon(),
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
