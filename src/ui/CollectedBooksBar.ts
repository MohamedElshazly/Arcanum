import type { SpellElement } from '../spells/SpellDefinitions'
import { COLLECTED_BOOKS_MAX_VISIBLE, COLLECTED_BOOK_ICON_PX } from '../constants'

export interface CollectedBook {
  id:        string
  spellIds:  string[]
  enemyName: string
  element:   SpellElement
}

export class CollectedBooksBar {
  private container: HTMLDivElement
  private books:     CollectedBook[] = []
  private onBookClick: (book: CollectedBook) => void
  private ownedSpells: () => string[]

  constructor(
    container: HTMLDivElement,
    ownedSpells: () => string[],
    onBookClick: (book: CollectedBook) => void,
  ) {
    this.container   = container
    this.ownedSpells = ownedSpells
    this.onBookClick = onBookClick
  }

  addBook(spellIds: string[], enemyName: string, element: SpellElement): void {
    const id   = `book-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const book: CollectedBook = { id, spellIds, enemyName, element }
    this.books.push(book)
    this.render()
    const iconEl = this.container.querySelector(`[data-book-id="${id}"]`) as HTMLElement | null
    if (iconEl) {
      iconEl.classList.add('bouncing')
      iconEl.addEventListener('animationend', () => iconEl.classList.remove('bouncing'), { once: true })
    }
  }

  removeBook(id: string): void {
    const el = this.container.querySelector(`[data-book-id="${id}"]`) as HTMLElement | null
    if (el) {
      el.classList.add('removing')
      el.addEventListener('animationend', () => {
        this.books = this.books.filter(b => b.id !== id)
        this.render()
      }, { once: true })
    } else {
      this.books = this.books.filter(b => b.id !== id)
      this.render()
    }
  }

  refreshBadges(): void {
    this.render()
  }

  private countNewSpells(book: CollectedBook): number {
    const owned = this.ownedSpells()
    return book.spellIds.filter(id => !owned.includes(id)).length
  }

  private render(): void {
    this.container.innerHTML = ''

    const visible = this.books.slice(-COLLECTED_BOOKS_MAX_VISIBLE)
    const overflow = this.books.length - COLLECTED_BOOKS_MAX_VISIBLE

    if (overflow > 0) {
      const txt = document.createElement('div')
      txt.className   = 'collected-books-overflow'
      txt.textContent = `+${overflow}`
      this.container.appendChild(txt)
    }

    for (const book of visible) {
      const icon = document.createElement('div')
      icon.className              = 'collected-book-icon'
      icon.dataset.bookId         = book.id
      icon.style.width            = `${COLLECTED_BOOK_ICON_PX}px`
      icon.style.height           = `${COLLECTED_BOOK_ICON_PX}px`

      const newCount = this.countNewSpells(book)
      const badge    = document.createElement('div')
      badge.className = 'book-badge'
      if (newCount === 0) {
        badge.textContent = '✓'
        badge.classList.add('done')
      } else {
        badge.textContent = String(newCount)
      }
      icon.appendChild(badge)

      icon.addEventListener('click', () => this.onBookClick(book))
      this.container.appendChild(icon)
    }
  }

  dispose(): void {
    this.container.innerHTML = ''
    this.books = []
  }
}
