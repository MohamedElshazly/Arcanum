import { SPELLS } from '../spells/SpellDefinitions'
import type { SpellElement } from '../spells/SpellDefinitions'
import { getSpellIcon, ELEMENT_GRADIENTS } from './SpellIcons'
import type { PlayerInventory, ActiveLoadout } from '../progression/PlayerInventory'
import type { MasterySystem } from '../progression/MasterySystem'
import type { Grimoire } from '../progression/Grimoire'

export interface SpellbookResult {
  type: 'enter_dungeon' | 'claim_spells'
  claimedSpells?: string[]
}

export interface SpellbookConfig {
  root: HTMLElement
  owner: 'player' | 'enemy'
  spells: string[]
  inventory: PlayerInventory
  mastery?: MasterySystem
  grimoire?: Grimoire
  booksCollected?: number
  maxPicks?: number
  onConfirm: (context: SpellbookResult) => void
}

const KEY_LABELS = ['Q', 'E', 'R', 'F']
const FILTER_TABS: { label: string; filter: string }[] = [
  { label: 'All', filter: 'all' },
  { label: 'Fire', filter: 'fire' },
  { label: 'Ice', filter: 'ice' },
  { label: 'Lightning', filter: 'lightning' },
  { label: 'Arcane', filter: 'arcane' },
]

export class Spellbook {
  private config: SpellbookConfig
  activeFilter = 'all'
  private selectedSpellId: string | null = null
  private claimedSpells: string[] = []

  constructor(config: SpellbookConfig) {
    this.config = config
  }

  show(): void {
    const { root, owner } = this.config
    root.innerHTML = ''

    const overlay = document.createElement('div')
    overlay.className = 'spellbook-overlay'
    overlay.setAttribute('data-owner', owner)

    const book = document.createElement('div')
    book.className = 'spellbook-book'

    const leftPage = document.createElement('div')
    leftPage.className = 'spellbook-page spellbook-page-left'

    const rightPage = document.createElement('div')
    rightPage.className = 'spellbook-page spellbook-page-right'

    if (owner === 'player') {
      this.buildPlayerLeftPage(leftPage)
      this.buildPlayerRightPage(rightPage)
    } else {
      this.buildEnemyLeftPage(leftPage)
      this.buildEnemyRightPage(rightPage)
    }

    book.appendChild(leftPage)
    book.appendChild(rightPage)
    overlay.appendChild(book)
    root.appendChild(overlay)
    root.classList.add('visible')

    // Trigger fade-in animation
    requestAnimationFrame(() => overlay.classList.add('open'))
  }

  dispose(): void {
    this.config.root.classList.remove('visible')
    this.config.root.innerHTML = ''
    this.selectedSpellId = null
    this.claimedSpells = []
    this.activeFilter = 'all'
  }

  // ── Player Left Page ─────────────────────────────────────────────────────

  private buildPlayerLeftPage(page: HTMLElement): void {
    // Filter tabs
    const tabsContainer = document.createElement('div')
    tabsContainer.className = 'spellbook-tabs'

    for (const tab of FILTER_TABS) {
      const btn = document.createElement('button')
      btn.className = 'spellbook-tab'
      if (tab.filter === this.activeFilter) btn.classList.add('active')
      btn.setAttribute('data-filter', tab.filter)
      btn.textContent = tab.label
      btn.addEventListener('click', () => {
        this.activeFilter = tab.filter
        this.refreshSpellGrid(page)
        tabsContainer.querySelectorAll('.spellbook-tab').forEach(t => t.classList.remove('active'))
        btn.classList.add('active')
      })
      tabsContainer.appendChild(btn)
    }
    page.appendChild(tabsContainer)

    // Title
    const title = document.createElement('h2')
    title.className = 'spellbook-title'
    title.textContent = 'Grimoire'
    page.appendChild(title)

    const subtitle = document.createElement('p')
    subtitle.className = 'spellbook-subtitle'
    subtitle.textContent = 'Select spells for your loadout'
    page.appendChild(subtitle)

    // Spell grid
    const grid = document.createElement('div')
    grid.className = 'spellbook-spell-grid'
    this.populatePlayerGrid(grid)
    page.appendChild(grid)
  }

  private refreshSpellGrid(page: HTMLElement): void {
    const grid = page.querySelector('.spellbook-spell-grid')
    if (!grid) return
    grid.innerHTML = ''
    if (this.config.owner === 'player') {
      this.populatePlayerGrid(grid as HTMLElement)
    }
  }

  private populatePlayerGrid(grid: HTMLElement): void {
    const { spells, inventory, mastery } = this.config
    const filtered = this.activeFilter === 'all'
      ? spells
      : spells.filter(id => SPELLS[id]?.element === this.activeFilter)

    for (const spellId of filtered) {
      const spell = SPELLS[spellId]
      if (!spell) continue

      const card = this.createSpellCard(spell)
      const owned = inventory.ownsSpell(spellId)

      if (!owned) {
        card.classList.add('locked')
      }

      if (this.selectedSpellId === spellId) {
        card.classList.add('selected')
      }

      // Mastery stars
      if (mastery) {
        const level = mastery.getMasteryLevel(spellId)
        const stars = document.createElement('div')
        stars.className = 'spellbook-mastery-stars'
        stars.textContent = '\u2605'.repeat(level) + '\u2606'.repeat(3 - level)
        card.appendChild(stars)
      }

      card.addEventListener('click', () => {
        if (!owned) {
          card.classList.add('card-shake')
          card.addEventListener('animationend', () => {
            card.classList.remove('card-shake')
          }, { once: true })
          return
        }
        if (this.selectedSpellId === spellId) {
          this.selectedSpellId = null
          card.classList.remove('selected')
        } else {
          // Remove selected from previous
          const prev = grid.querySelector('.spellbook-spell-card.selected')
          if (prev) prev.classList.remove('selected')
          this.selectedSpellId = spellId
          card.classList.add('selected')
        }
      })

      grid.appendChild(card)
    }
  }

  // ── Enemy Left Page ──────────────────────────────────────────────────────

  private buildEnemyLeftPage(page: HTMLElement): void {
    const badge = document.createElement('div')
    badge.className = 'spellbook-enemy-badge'
    badge.textContent = '\u2620'
    page.appendChild(badge)

    const title = document.createElement('h2')
    title.className = 'spellbook-title'
    title.textContent = 'Collected Spells'
    page.appendChild(title)

    const subtitle = document.createElement('p')
    subtitle.className = 'spellbook-subtitle'
    subtitle.textContent = `Books absorbed: ${this.config.booksCollected ?? 0}`
    page.appendChild(subtitle)

    if (this.config.spells.length === 0) {
      const emptyMsg = document.createElement('div')
      emptyMsg.className = 'spellbook-empty-msg'
      emptyMsg.textContent = 'No spellbooks collected this run'
      page.appendChild(emptyMsg)
    } else {
      const grid = document.createElement('div')
      grid.className = 'spellbook-spell-grid single-column'
      this.populateEnemyGrid(grid)
      page.appendChild(grid)
    }
  }

  private populateEnemyGrid(grid: HTMLElement): void {
    const { spells, inventory } = this.config
    const maxPicks = this.config.maxPicks ?? 3

    for (const spellId of spells) {
      const spell = SPELLS[spellId]
      if (!spell) continue

      const card = this.createSpellCard(spell)
      const alreadyOwned = inventory.ownsSpell(spellId)

      if (alreadyOwned) {
        card.classList.add('already-owned')
      }

      if (this.claimedSpells.includes(spellId)) {
        card.classList.add('claimed')
      }

      card.addEventListener('click', () => {
        if (alreadyOwned) return

        if (this.claimedSpells.includes(spellId)) {
          this.claimedSpells = this.claimedSpells.filter(id => id !== spellId)
          card.classList.remove('claimed')
          this.refreshEnemyRightPage()
          return
        }

        if (this.claimedSpells.length >= maxPicks) return

        this.claimedSpells.push(spellId)
        card.classList.add('claimed')
        this.refreshEnemyRightPage()
      })

      grid.appendChild(card)
    }
  }

  // ── Shared Spell Card ────────────────────────────────────────────────────

  private createSpellCard(spell: typeof SPELLS[string]): HTMLElement {
    const card = document.createElement('div')
    card.className = 'spellbook-spell-card'
    card.setAttribute('data-spell-id', spell.id)
    card.setAttribute('data-element', spell.element)

    const [gradStart, gradEnd] = ELEMENT_GRADIENTS[spell.element]

    const iconBox = document.createElement('div')
    iconBox.className = 'spellbook-spell-icon'
    iconBox.style.background = `linear-gradient(135deg, ${gradStart}, ${gradEnd})`
    iconBox.innerHTML = getSpellIcon(spell.id)

    const info = document.createElement('div')
    info.className = 'spellbook-spell-info'

    const name = document.createElement('div')
    name.className = 'spellbook-spell-name'
    name.textContent = spell.name

    const meta = document.createElement('div')
    meta.className = 'spellbook-spell-meta'
    meta.textContent = `${spell.manaCost} \u2726 \u00b7 ${spell.cooldown}s`

    info.appendChild(name)
    info.appendChild(meta)
    card.appendChild(iconBox)
    card.appendChild(info)

    return card
  }

  // ── Player Right Page ────────────────────────────────────────────────────

  private buildPlayerRightPage(page: HTMLElement): void {
    const title = document.createElement('h2')
    title.className = 'spellbook-title'
    title.textContent = 'Loadout'
    page.appendChild(title)

    this.buildLoadoutBar(page, 1, 'Bar 1')
    this.buildLoadoutBar(page, 2, 'Bar 2')

    // Passives
    if (this.config.grimoire) {
      const passivesSection = document.createElement('div')
      passivesSection.className = 'spellbook-passives-section'

      const passivesTitle = document.createElement('h3')
      passivesTitle.textContent = 'Passives'
      passivesSection.appendChild(passivesTitle)

      const passives = this.config.grimoire.getActivePassives()
      for (const passive of passives) {
        const pill = document.createElement('div')
        pill.className = 'spellbook-passive-pill'
        pill.setAttribute('data-element', passive.element)
        pill.textContent = passive.description
        passivesSection.appendChild(pill)
      }

      page.appendChild(passivesSection)
    }

    // Confirm button
    const btn = document.createElement('button')
    btn.className = 'spellbook-confirm-btn'
    btn.textContent = 'Enter Dungeon'
    btn.addEventListener('click', () => {
      this.config.onConfirm({ type: 'enter_dungeon' })
    })
    page.appendChild(btn)
  }

  private buildLoadoutBar(page: HTMLElement, bar: 1 | 2, label: string): void {
    const barContainer = document.createElement('div')
    barContainer.className = 'spellbook-loadout-bar'

    const barLabel = document.createElement('h3')
    barLabel.textContent = label
    barContainer.appendChild(barLabel)

    const slotsRow = document.createElement('div')
    slotsRow.className = 'spellbook-loadout-slots'

    const loadout = this.config.inventory.activeLoadout
    const barKey = bar === 1 ? 'bar1' : 'bar2'
    const barSlots = loadout[barKey]

    for (let i = 0; i < 4; i++) {
      const slot = document.createElement('div')
      slot.className = 'spellbook-loadout-slot'
      slot.setAttribute('data-bar', String(bar))
      slot.setAttribute('data-slot', String(i))

      const keyLabel = document.createElement('div')
      keyLabel.className = 'spellbook-slot-key'
      keyLabel.textContent = KEY_LABELS[i]
      slot.appendChild(keyLabel)

      const spellId = barSlots[i]
      if (spellId) {
        const spell = SPELLS[spellId]
        if (spell) {
          const icon = document.createElement('div')
          icon.className = 'spellbook-spell-icon'
          icon.innerHTML = getSpellIcon(spellId)
          slot.appendChild(icon)

          const name = document.createElement('div')
          name.className = 'spellbook-slot-name'
          name.textContent = spell.name
          slot.appendChild(name)

          slot.classList.add('filled')
        }
      } else {
        const empty = document.createElement('div')
        empty.className = 'spellbook-slot-empty'
        empty.textContent = 'empty'
        slot.appendChild(empty)
      }

      slot.addEventListener('click', () => {
        if (slot.classList.contains('filled')) {
          // Unequip
          const slotBar = Number(slot.getAttribute('data-bar')) as 1 | 2
          const slotIdx = Number(slot.getAttribute('data-slot')) as 0 | 1 | 2 | 3
          this.config.inventory.assignSpell(slotBar, slotIdx, null)
          this.rebuildPlayerPage()
        } else if (this.selectedSpellId) {
          // Equip selected spell
          const slotBar = Number(slot.getAttribute('data-bar')) as 1 | 2
          const slotIdx = Number(slot.getAttribute('data-slot')) as 0 | 1 | 2 | 3
          this.config.inventory.removeSpellFromLoadout(this.selectedSpellId)
          this.config.inventory.assignSpell(slotBar, slotIdx, this.selectedSpellId)
          this.selectedSpellId = null
          this.rebuildPlayerPage()
        }
      })

      slotsRow.appendChild(slot)
    }

    barContainer.appendChild(slotsRow)
    page.appendChild(barContainer)
  }

  private rebuildPlayerPage(): void {
    const overlay = this.config.root.querySelector('.spellbook-overlay')
    if (!overlay) return
    const book = overlay.querySelector('.spellbook-book')
    if (!book) return
    book.innerHTML = ''

    const leftPage = document.createElement('div')
    leftPage.className = 'spellbook-page spellbook-page-left'

    const rightPage = document.createElement('div')
    rightPage.className = 'spellbook-page spellbook-page-right'

    this.buildPlayerLeftPage(leftPage)
    this.buildPlayerRightPage(rightPage)

    book.appendChild(leftPage)
    book.appendChild(rightPage)
  }

  // ── Enemy Right Page ─────────────────────────────────────────────────────

  private buildEnemyRightPage(page: HTMLElement): void {
    const title = document.createElement('h2')
    title.className = 'spellbook-title'
    title.textContent = 'Claimed Spells'
    page.appendChild(title)

    const slotsContainer = document.createElement('div')
    slotsContainer.className = 'spellbook-claim-slots'

    const maxPicks = this.config.maxPicks ?? 3

    for (let i = 0; i < maxPicks; i++) {
      const slot = document.createElement('div')
      slot.className = 'spellbook-claim-slot'

      const claimed = this.claimedSpells[i]
      if (claimed) {
        const spell = SPELLS[claimed]
        if (spell) {
          const icon = document.createElement('div')
          icon.className = 'spellbook-spell-icon'
          icon.innerHTML = getSpellIcon(claimed)
          slot.appendChild(icon)

          const name = document.createElement('div')
          name.className = 'spellbook-slot-name'
          name.textContent = spell.name
          slot.appendChild(name)

          slot.classList.add('filled')
          slot.addEventListener('click', () => {
            this.claimedSpells = this.claimedSpells.filter(id => id !== claimed)
            // refresh card state
            const card = this.config.root.querySelector(`.spellbook-spell-card[data-spell-id="${claimed}"]`)
            if (card) card.classList.remove('claimed')
            this.refreshEnemyRightPage()
          })
        }
      } else {
        const empty = document.createElement('div')
        empty.className = 'spellbook-slot-empty'
        empty.textContent = 'empty'
        slot.appendChild(empty)
      }

      slotsContainer.appendChild(slot)
    }

    page.appendChild(slotsContainer)

    // Picks remaining
    const counter = document.createElement('div')
    counter.className = 'spellbook-picks-counter'
    counter.textContent = `${maxPicks - this.claimedSpells.length} picks remaining`
    page.appendChild(counter)

    // Confirm button
    const btn = document.createElement('button')
    btn.className = 'spellbook-confirm-btn'
    btn.textContent = 'Start New Run'
    btn.addEventListener('click', () => {
      this.config.onConfirm({
        type: 'claim_spells',
        claimedSpells: [...this.claimedSpells],
      })
    })
    page.appendChild(btn)
  }

  private refreshEnemyRightPage(): void {
    const rightPage = this.config.root.querySelector('.spellbook-page-right')
    if (!rightPage) return
    rightPage.innerHTML = ''
    this.buildEnemyRightPage(rightPage as HTMLElement)
  }
}
