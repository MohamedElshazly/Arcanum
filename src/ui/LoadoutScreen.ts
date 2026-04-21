import { SpritesheetAnimator } from './SpritesheetAnimator'
import { SPELLS }              from '../spells/SpellDefinitions'
import type { PlayerInventory } from '../progression/PlayerInventory'
import type { MasterySystem }   from '../progression/MasterySystem'
import type { Grimoire }        from '../progression/Grimoire'

const SPELL_ICON_MAP: Record<string, string> = {
  fireball: 'Icon1_big', flame_lance: 'Icon2_big', ember_shot: 'Icon3_big', pyroblast: 'Icon4_big',
  frost_bolt: 'Icon5_big', ice_wall: 'Icon6_big', frozen_nova: 'Icon7_big', glacial_spike: 'Icon8_big',
  chain_lightning: 'Icon9_big', thunder_clap: 'Icon10_big', spark: 'Icon11_big', static_field: 'Icon12_big',
  arcane_missile: 'Icon13_big', blink: 'Icon14_big', mana_siphon: 'Icon15_big', arcane_explosion: 'Icon16_big',
}

const ELEMENT_COLOR: Record<string, string> = {
  fire: '#ff6600', ice: '#44aaff', lightning: '#ffff44', arcane: '#bb44ff', all: '#d4b483',
}

const SLOT_KEYS = ['Q', 'E', 'R', 'F']

export interface LoadoutScreenConfig {
  root:           HTMLDivElement
  inventory:      PlayerInventory
  mastery:        MasterySystem
  grimoire:       Grimoire
  onEnterDungeon: () => void
}

export class LoadoutScreen {
  private root:       HTMLDivElement
  private config:     LoadoutScreenConfig
  private animator:   SpritesheetAnimator | null = null
  private animRafId:  number = 0
  private selectedSpell: string | null = null
  private activeFilter: string = 'all'

  constructor(config: LoadoutScreenConfig) {
    this.root   = config.root
    this.config = config
  }

  show(): void {
    this.root.innerHTML = ''
    this.buildDOM()
    this.root.classList.add('visible')

    const gameCanvas = document.getElementById('game-canvas')
    if (gameCanvas) (gameCanvas as HTMLElement).style.filter = 'blur(4px)'
    document.getElementById('hud')!.style.visibility = 'hidden'

    const animCanvas = this.root.querySelector('.loadout-anim-canvas') as HTMLCanvasElement
    animCanvas.classList.add('visible')

    const anim = new SpritesheetAnimator(animCanvas, {
      imagePath:  '/assets/spellbook/PNG/pages_apper.png',
      frameCount: 7,
      fps:        18,
      loop:       false,
      onComplete: () => {
        this.stopAnimLoop()
        animCanvas.classList.remove('visible')
        anim.dispose()
        this.animator = null
        this.showContent()
      },
    })
    this.animator = anim
    anim.load().then(() => { anim.play(); this.startAnimLoop(anim) }).catch(() => {
      this.stopAnimLoop()
      animCanvas.classList.remove('visible')
      this.showContent()
    })
  }

  private showContent(): void {
    const content = this.root.querySelector('.loadout-page-content') as HTMLElement | null
    if (content) content.classList.add('visible')
  }

  dispose(): void {
    this.stopAnimLoop()
    if (this.animator) { this.animator.dispose(); this.animator = null }
    const gameCanvas = document.getElementById('game-canvas')
    if (gameCanvas) (gameCanvas as HTMLElement).style.filter = ''
    document.getElementById('hud')!.style.visibility = 'visible'
    this.root.classList.remove('visible')
    this.root.innerHTML = ''
  }

  private startAnimLoop(animator: SpritesheetAnimator): void {
    this.stopAnimLoop()
    let last = performance.now()
    const tick = (now: number) => {
      animator.update((now - last) / 1000)
      last = now
      this.animRafId = requestAnimationFrame(tick)
    }
    this.animRafId = requestAnimationFrame(tick)
  }

  private stopAnimLoop(): void {
    if (this.animRafId) {
      cancelAnimationFrame(this.animRafId)
      this.animRafId = 0
    }
  }

  private buildDOM(): void {
    const wrap = document.createElement('div')
    wrap.className = 'loadout-book-wrap'

    const bookBg = document.createElement('img')
    bookBg.src       = '/assets/spellbook/PNG/Open_book_bookmarks1.png'
    bookBg.className = 'loadout-book-bg'
    bookBg.alt       = ''
    wrap.appendChild(bookBg)

    const animCanvas = document.createElement('canvas')
    animCanvas.className = 'loadout-anim-canvas'
    wrap.appendChild(animCanvas)

    // One wrapper for both pages so they fade in together
    const pageContent = document.createElement('div')
    pageContent.className = 'loadout-page-content'

    pageContent.appendChild(this.buildLeftPage())
    pageContent.appendChild(this.buildRightPage())
    wrap.appendChild(pageContent)
    this.root.appendChild(wrap)
  }

  // ── Left page ──────────────────────────────────────────────────────────────

  private buildLeftPage(): HTMLDivElement {
    const page = document.createElement('div')
    page.className = 'loadout-page-left'

    const header = document.createElement('div')
    header.className   = 'loadout-page-header'
    header.textContent = 'Grimoire'
    page.appendChild(header)

    page.appendChild(this.buildTabs())

    const grid = document.createElement('div')
    grid.className = 'loadout-spell-grid'
    grid.id        = 'loadout-spell-grid'
    page.appendChild(grid)

    this.renderSpellGrid(grid)
    return page
  }

  private buildTabs(): HTMLDivElement {
    const tabs = document.createElement('div')
    tabs.className = 'loadout-tabs'

    const elements = ['all', 'fire', 'ice', 'lightning', 'arcane'] as const
    for (const el of elements) {
      const tab = document.createElement('div')
      tab.className     = 'loadout-tab' + (el === this.activeFilter ? ' active' : '')
      tab.dataset.filter = el

      const tabImg = document.createElement('img')
      tabImg.src       = '/assets/spellbook/PNG/bookmarks.png'
      tabImg.className = 'tab-bookmark-img'
      tabImg.alt       = ''
      tab.appendChild(tabImg)

      const label = document.createElement('span')
      label.className   = 'tab-label'
      label.textContent = el.charAt(0).toUpperCase() + el.slice(1)
      tab.appendChild(label)

      tab.addEventListener('click', () => this.onTabClick(el))
      tabs.appendChild(tab)
    }
    return tabs
  }

  private onTabClick(filter: string): void {
    if (filter === this.activeFilter) return
    this.activeFilter = filter

    const allTabs = this.root.querySelectorAll('.loadout-tab')
    allTabs.forEach(t => {
      t.classList.toggle('active', (t as HTMLElement).dataset.filter === filter)
    })

    const grid = document.getElementById('loadout-spell-grid')
    if (!grid) return
    grid.style.opacity = '0'
    setTimeout(() => {
      this.renderSpellGrid(grid as HTMLDivElement)
      grid.style.opacity = '1'
    }, 150)
  }

  private renderSpellGrid(grid: HTMLDivElement): void {
    grid.innerHTML = ''
    const pool   = this.config.inventory.spellPool
    const allIds = Object.keys(SPELLS)

    const filtered = this.activeFilter === 'all'
      ? allIds
      : allIds.filter(id => SPELLS[id].element === this.activeFilter)

    for (const spellId of filtered) {
      const spell   = SPELLS[spellId]
      const owned   = pool.includes(spellId)
      const level   = this.config.mastery.getMasteryLevel(spellId)
      const evolved = level === 3 && !!spell.masteryEvolvesTo
      const card    = this.buildSpellCard(spellId, owned, level, evolved)
      grid.appendChild(card)
    }
  }

  private buildSpellCard(spellId: string, owned: boolean, level: 0|1|2|3, evolved: boolean): HTMLDivElement {
    const spell  = SPELLS[spellId]
    const card   = document.createElement('div')
    card.className         = 'loadout-spell-card'
    card.dataset.spellId   = spellId
    card.dataset.element   = spell.element

    if (!owned)   card.classList.add('locked')
    if (evolved)  card.classList.add('evolved')
    if (this.selectedSpell === spellId) card.classList.add('selected')

    const iconName = SPELL_ICON_MAP[spellId] ?? 'Icon1_big'
    const icon     = document.createElement('img')
    icon.src             = `/assets/spellbook/PNG/Icons/${iconName}.png`
    icon.className       = 'spell-card-icon'
    icon.style.imageRendering = 'pixelated'
    icon.alt             = spell.name
    card.appendChild(icon)

    const name = document.createElement('div')
    name.className   = 'spell-card-name'
    name.textContent = spell.name
    card.appendChild(name)

    const meta = document.createElement('div')
    meta.className = 'spell-card-meta'

    const dot = document.createElement('div')
    dot.className             = 'spell-card-dot'
    dot.style.backgroundColor = ELEMENT_COLOR[spell.element] ?? '#888'
    meta.appendChild(dot)

    const mana = document.createElement('div')
    mana.className   = 'spell-card-mana'
    mana.textContent = `${spell.manaCost}mp`
    meta.appendChild(mana)

    const cd = document.createElement('div')
    cd.className   = 'spell-card-cd'
    cd.textContent = `${spell.cooldown}s`
    meta.appendChild(cd)

    card.appendChild(meta)

    const stars = document.createElement('div')
    stars.className   = 'spell-card-stars'
    stars.textContent = ['★','★','★'].map((_, i) => i < level ? '★' : '☆').join('')
    card.appendChild(stars)

    const progressWrap = document.createElement('div')
    progressWrap.className = 'spell-card-progress-wrap'
    const progressFill = document.createElement('div')
    progressFill.className = 'spell-card-progress-fill'
    const progress = this.config.mastery.getProgressToNextLevel(spellId)
    progressFill.style.width = `${Math.round(progress * 100)}%`
    progressWrap.appendChild(progressFill)
    card.appendChild(progressWrap)

    if (!owned) {
      const lock = document.createElement('div')
      lock.className   = 'spell-card-lock'
      lock.textContent = '🔒'
      card.appendChild(lock)
    }

    card.addEventListener('click', () => {
      if (!owned) {
        card.classList.remove('card-shake')
        void card.offsetWidth
        card.classList.add('card-shake')
        card.addEventListener('animationend', () => card.classList.remove('card-shake'), { once: true })
        return
      }
      this.selectSpell(spellId)
    })

    return card
  }

  private selectSpell(spellId: string): void {
    this.selectedSpell = this.selectedSpell === spellId ? null : spellId
    this.root.querySelectorAll('.loadout-spell-card').forEach(el => {
      const htmlEl = el as HTMLElement
      htmlEl.classList.toggle('selected', htmlEl.dataset.spellId === this.selectedSpell)
    })
    this.updateEnterButton()
  }

  // ── Right page ─────────────────────────────────────────────────────────────

  private buildRightPage(): HTMLDivElement {
    const page = document.createElement('div')
    page.className = 'loadout-page-right'

    const header = document.createElement('div')
    header.className   = 'loadout-page-header'
    header.textContent = 'Loadout'
    page.appendChild(header)

    for (const bar of [1, 2] as const) {
      const section = document.createElement('div')
      section.className = 'loadout-bar-section'

      const label = document.createElement('div')
      label.className   = 'loadout-bar-label'
      label.textContent = `Bar ${bar}`
      section.appendChild(label)

      const row = document.createElement('div')
      row.className = 'loadout-slots-row'
      row.id        = `loadout-bar${bar}-slots`

      const barLoadout = bar === 1 ? this.config.inventory.activeLoadout.bar1 : this.config.inventory.activeLoadout.bar2
      for (let s = 0; s < 4; s++) {
        row.appendChild(this.buildSlot(bar, s as 0|1|2|3, barLoadout[s]))
      }

      section.appendChild(row)
      page.appendChild(section)
    }

    page.appendChild(this.buildPassivesPanel())

    const enterBtn = document.createElement('button')
    enterBtn.className = 'loadout-enter-btn'
    enterBtn.id        = 'loadout-enter-btn'
    enterBtn.textContent = 'Enter Dungeon'
    enterBtn.disabled    = !this.config.inventory.hasAnySpellAssigned()
    enterBtn.addEventListener('click', () => this.onEnterDungeon())
    page.appendChild(enterBtn)

    return page
  }

  private buildSlot(bar: 1|2, slot: 0|1|2|3, assignedId: string | null): HTMLDivElement {
    const div = document.createElement('div')
    div.className = 'loadout-slot'
    div.dataset.bar  = String(bar)
    div.dataset.slot = String(slot)
    if (!assignedId) div.classList.add('empty')

    const keyLabel = document.createElement('div')
    keyLabel.className   = 'slot-key-label'
    keyLabel.textContent = SLOT_KEYS[slot]
    div.appendChild(keyLabel)

    if (assignedId) {
      const spell = SPELLS[assignedId]
      if (spell) {
        div.dataset.element = spell.element
        const icon = document.createElement('img')
        const iconName = SPELL_ICON_MAP[assignedId] ?? 'Icon1_big'
        icon.src             = `/assets/spellbook/PNG/Icons/${iconName}.png`
        icon.className       = 'loadout-slot-icon'
        icon.style.imageRendering = 'pixelated'
        icon.alt             = spell.name
        div.appendChild(icon)

        const name = document.createElement('div')
        name.className   = 'loadout-slot-name'
        name.textContent = spell.name.slice(0, 10)
        div.appendChild(name)
      }
    } else {
      const emptyText = document.createElement('div')
      emptyText.className   = 'loadout-slot-empty-text'
      emptyText.textContent = 'empty'
      div.appendChild(emptyText)
    }

    div.addEventListener('click', () => this.onSlotClick(bar, slot, assignedId))
    return div
  }

  private onSlotClick(bar: 1|2, slot: 0|1|2|3, currentId: string | null): void {
    if (currentId) {
      this.config.inventory.assignSpell(bar, slot, null)
      this.selectedSpell = null
    } else if (this.selectedSpell) {
      // Remove from any other slot first
      this.config.inventory.removeSpellFromLoadout(this.selectedSpell)
      this.config.inventory.assignSpell(bar, slot, this.selectedSpell)
      this.selectedSpell = null
    }
    this.rebuildSlots()
    this.updateEnterButton()
  }

  private rebuildSlots(): void {
    for (const bar of [1, 2] as const) {
      const row = document.getElementById(`loadout-bar${bar}-slots`)
      if (!row) continue
      row.innerHTML = ''
      const barLoadout = bar === 1 ? this.config.inventory.activeLoadout.bar1 : this.config.inventory.activeLoadout.bar2
      for (let s = 0; s < 4; s++) {
        row.appendChild(this.buildSlot(bar, s as 0|1|2|3, barLoadout[s]))
      }
    }
  }

  private buildPassivesPanel(): HTMLDivElement {
    const panel = document.createElement('div')
    panel.className = 'loadout-passives'

    const header = document.createElement('div')
    header.className   = 'loadout-passives-header'
    header.textContent = 'Grimoire Passives'
    panel.appendChild(header)

    const list = document.createElement('div')
    list.className = 'loadout-passives-list'

    const passives = this.config.grimoire.getActivePassives()
    if (passives.length === 0) {
      const empty = document.createElement('div')
      empty.className   = 'loadout-no-passives'
      empty.textContent = 'Absorb enemy spell books to unlock passives'
      list.appendChild(empty)
    } else {
      for (const p of passives) {
        const pill = document.createElement('div')
        pill.className        = 'loadout-passive-pill'
        pill.dataset.element  = p.element

        const dot = document.createElement('div')
        dot.className             = 'loadout-passive-dot'
        dot.style.backgroundColor = ELEMENT_COLOR[p.element] ?? '#d4b483'
        pill.appendChild(dot)

        const desc = document.createElement('span')
        desc.textContent = p.description
        pill.appendChild(desc)

        list.appendChild(pill)
      }
    }

    panel.appendChild(list)
    return panel
  }

  private updateEnterButton(): void {
    const btn = document.getElementById('loadout-enter-btn') as HTMLButtonElement | null
    if (btn) btn.disabled = !this.config.inventory.hasAnySpellAssigned()
  }

  // ── Enter Dungeon ──────────────────────────────────────────────────────────

  private onEnterDungeon(): void {
    const content = this.root.querySelector('.loadout-page-content') as HTMLElement | null
    if (content) {
      content.style.opacity = '0'
      content.style.transition = 'opacity 0.15s ease'
    }

    const animCanvas = this.root.querySelector('.loadout-anim-canvas') as HTMLCanvasElement
    animCanvas.classList.add('visible')

    const anim = new SpritesheetAnimator(animCanvas, {
      imagePath:  '/assets/spellbook/PNG/pages_desappear-Sheet.png',
      frameCount: 7,
      fps:        18,
      loop:       false,
      onComplete: () => {
        this.stopAnimLoop()
        anim.dispose()
        this.root.classList.remove('visible')
        const gameCanvas = document.getElementById('game-canvas')
        if (gameCanvas) (gameCanvas as HTMLElement).style.filter = ''
        document.getElementById('hud')!.style.visibility = 'visible'
        this.config.onEnterDungeon()
      },
    })
    this.stopAnimLoop()
    if (this.animator) { this.animator.dispose() }
    this.animator = anim
    anim.load().then(() => { anim.play(); this.startAnimLoop(anim) }).catch(() => {
      animCanvas.classList.remove('visible')
      this.root.classList.remove('visible')
      const gameCanvas = document.getElementById('game-canvas')
      if (gameCanvas) (gameCanvas as HTMLElement).style.filter = ''
      document.getElementById('hud')!.style.visibility = 'visible'
      this.config.onEnterDungeon()
    })
  }
}
