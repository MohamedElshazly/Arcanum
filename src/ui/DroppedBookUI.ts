import { SpritesheetAnimator } from './SpritesheetAnimator'
import { SPELLS }              from '../spells/SpellDefinitions'
import type { CollectedBook }  from './CollectedBooksBar'

const SPELL_ICON_MAP: Record<string, string> = {
  fireball: 'Icon1_big', flame_lance: 'Icon2_big', ember_shot: 'Icon3_big', pyroblast: 'Icon4_big',
  frost_bolt: 'Icon5_big', ice_wall: 'Icon6_big', frozen_nova: 'Icon7_big', glacial_spike: 'Icon8_big',
  chain_lightning: 'Icon9_big', thunder_clap: 'Icon10_big', spark: 'Icon11_big', static_field: 'Icon12_big',
  arcane_missile: 'Icon13_big', blink: 'Icon14_big', mana_siphon: 'Icon15_big', arcane_explosion: 'Icon16_big',
}

export class DroppedBookUI {
  private root:      HTMLDivElement
  private wrap:      HTMLDivElement | null = null
  private animator:  SpritesheetAnimator | null = null
  private onClose:   () => void
  private isOpen     = false

  constructor(root: HTMLDivElement, onClose: () => void) {
    this.root    = root
    this.onClose = onClose
  }

  open(
    book:         CollectedBook,
    ownedSpells:  string[],
    onAbsorb:     (spellId: string) => void,
  ): void {
    if (this.isOpen) this.forceClose()
    this.isOpen = true
    this.buildDOM(book, ownedSpells, onAbsorb)
  }

  close(): void {
    if (!this.isOpen || !this.wrap) return
    this.playCloseAnimation(() => {
      this.forceClose()
    })
  }

  shakeOnDamage(): void {
    if (!this.wrap) return
    this.wrap.classList.remove('dropped-book-shake')
    void this.wrap.offsetWidth
    this.wrap.classList.add('dropped-book-shake')
    this.wrap.addEventListener('animationend', () => this.wrap?.classList.remove('dropped-book-shake'), { once: true })
  }

  get isVisible(): boolean { return this.isOpen }

  dispose(): void {
    this.forceClose()
  }

  private forceClose(): void {
    this.isOpen = false
    if (this.animator) { this.animator.dispose(); this.animator = null }
    this.root.innerHTML = ''
    this.wrap = null
    this.onClose()
  }

  private buildDOM(
    book:        CollectedBook,
    ownedSpells: string[],
    onAbsorb:    (spellId: string) => void,
  ): void {
    this.root.innerHTML = ''
    const wrap = document.createElement('div')
    wrap.className = 'dropped-book-wrap'
    this.wrap = wrap

    const bg = document.createElement('img')
    bg.src       = '/assets/spellbook/PNG/Open_book_bookmarks2.png'
    bg.className = 'dropped-book-bg'
    bg.style.imageRendering = 'pixelated'
    wrap.appendChild(bg)

    const animCanvas = document.createElement('canvas')
    animCanvas.className = 'dropped-book-anim-canvas'
    wrap.appendChild(animCanvas)

    const content = document.createElement('div')
    content.className = 'dropped-book-content'

    const closeBtn = document.createElement('button')
    closeBtn.className   = 'dropped-book-close'
    closeBtn.textContent = '×'
    closeBtn.addEventListener('click', () => this.close())
    wrap.appendChild(closeBtn)

    const header = document.createElement('div')
    header.className   = 'dropped-book-header'
    header.textContent = `${book.enemyName} Spell Book`
    content.appendChild(header)

    const grid = document.createElement('div')
    grid.className = 'dropped-book-grid'

    for (const spellId of book.spellIds) {
      const spell    = SPELLS[spellId]
      if (!spell) continue

      const alreadyOwned = ownedSpells.includes(spellId)

      const card  = document.createElement('div')
      card.className = 'dropped-spell-card'
      if (!alreadyOwned) card.classList.add('new-spell')

      const iconName = SPELL_ICON_MAP[spellId] ?? 'Icon1_big'
      const icon     = document.createElement('img')
      icon.src             = `/assets/spellbook/PNG/Icons/${iconName}.png`
      icon.className       = 'dropped-spell-icon'
      icon.style.imageRendering = 'pixelated'
      card.appendChild(icon)

      const name = document.createElement('div')
      name.className   = 'dropped-spell-name'
      name.textContent = spell.name
      card.appendChild(name)

      const badge = document.createElement('div')
      badge.className   = 'dropped-spell-badge'
      badge.textContent = alreadyOwned ? 'OWNED' : 'NEW'
      badge.classList.add(alreadyOwned ? 'owned' : 'new')
      card.appendChild(badge)

      const flash = document.createElement('div')
      flash.className = 'dropped-spell-flash'
      card.appendChild(flash)

      if (!alreadyOwned) {
        card.addEventListener('click', () => {
          onAbsorb(spellId)
          badge.textContent = 'OWNED'
          badge.classList.remove('new')
          badge.classList.add('owned')
          card.classList.remove('new-spell')
          card.style.cursor = 'default'
          flash.classList.add('active')
          setTimeout(() => flash.classList.remove('active'), 400)
          ownedSpells = [...ownedSpells, spellId]
        })
      }

      grid.appendChild(card)
    }

    content.appendChild(grid)
    wrap.appendChild(content)
    this.root.appendChild(wrap)

    this.playOpenAnimation(animCanvas, () => {
      content.classList.add('visible')
    })
  }

  private playOpenAnimation(canvas: HTMLCanvasElement, onDone: () => void): void {
    canvas.classList.add('visible')
    const anim = new SpritesheetAnimator(canvas, {
      imagePath:  '/assets/spellbook/PNG/pages_apper.png',
      frameCount: 7,
      fps:        18,
      loop:       false,
      onComplete: () => {
        canvas.classList.remove('visible')
        anim.dispose()
        this.animator = null
        onDone()
      },
    })
    this.animator = anim
    anim.load().then(() => anim.play())
  }

  private playCloseAnimation(onDone: () => void): void {
    if (!this.wrap) { onDone(); return }
    const canvas = this.wrap.querySelector('.dropped-book-anim-canvas') as HTMLCanvasElement
    const content = this.wrap.querySelector('.dropped-book-content') as HTMLElement
    content.classList.remove('visible')
    canvas.classList.add('visible')

    const anim = new SpritesheetAnimator(canvas, {
      imagePath:  '/assets/spellbook/PNG/pages_desappear-Sheet.png',
      frameCount: 7,
      fps:        18,
      loop:       false,
      onComplete: () => {
        anim.dispose()
        onDone()
      },
    })
    anim.load().then(() => anim.play())
  }
}
