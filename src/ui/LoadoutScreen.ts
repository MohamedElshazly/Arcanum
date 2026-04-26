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
  private difficultyEl: HTMLDivElement | null = null

  constructor(config: LoadoutScreenConfig) {
    this.config = config
  }

  show(): void {
    const allSpellIds = Object.keys(SPELLS)

    // Difficulty selector
    this.difficultyEl = document.createElement('div')
    this.difficultyEl.id = 'difficulty-selector'
    this.difficultyEl.style.cssText =
      'display:flex;align-items:center;justify-content:center;gap:12px;' +
      'padding:10px 0;font-family:monospace;color:#ddd;font-size:14px;'

    const leftBtn = document.createElement('button')
    leftBtn.textContent = '\u25C0'
    leftBtn.style.cssText =
      'background:none;border:1px solid #666;color:#ddd;font-size:16px;' +
      'cursor:pointer;padding:4px 10px;border-radius:4px;'

    const label = document.createElement('span')
    label.style.cssText = 'min-width:180px;text-align:center;'

    const rightBtn = document.createElement('button')
    rightBtn.textContent = '\u25B6'
    rightBtn.style.cssText = leftBtn.style.cssText

    const diff = this.config.difficulty

    const updateLabel = () => {
      label.textContent = `Difficulty: ${diff.name} (${diff.level})`
      leftBtn.style.opacity  = diff.level > 0 ? '1' : '0.3'
      rightBtn.style.opacity = diff.level < diff.maxUnlocked ? '1' : '0.3'
    }

    leftBtn.addEventListener('click', () => {
      diff.level = diff.level - 1
      updateLabel()
    })
    rightBtn.addEventListener('click', () => {
      diff.level = diff.level + 1
      updateLabel()
    })

    updateLabel()

    this.difficultyEl.appendChild(leftBtn)
    this.difficultyEl.appendChild(label)
    this.difficultyEl.appendChild(rightBtn)

    this.spellbook = new Spellbook({
      root: this.config.root,
      owner: 'player',
      spells: allSpellIds,
      inventory: this.config.inventory,
      mastery: this.config.mastery,
      grimoire: this.config.grimoire,
      audio: this.config.audio,
      onConfirm: () => this.config.onEnterDungeon(),
    })
    this.spellbook.show()

    // Append after spellbook.show() since it wipes root.innerHTML
    const overlay = this.config.root.querySelector('.spellbook-overlay')
    if (overlay) {
      overlay.insertBefore(this.difficultyEl, overlay.firstChild)
    } else {
      this.config.root.appendChild(this.difficultyEl)
    }
  }

  dispose(): void {
    if (this.difficultyEl) {
      this.difficultyEl.remove()
      this.difficultyEl = null
    }
    if (this.spellbook) {
      this.spellbook.dispose()
      this.spellbook = null
    }
  }
}
