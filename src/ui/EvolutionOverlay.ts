import { SPELLS }                  from '../spells/SpellDefinitions'
import { EVOLUTION_OVERLAY_DURATION_S } from '../constants'

export class EvolutionOverlay {
  private root:    HTMLDivElement
  private timerId: ReturnType<typeof setTimeout> | null = null

  constructor(root: HTMLDivElement) {
    this.root = root
    window.addEventListener('spellEvolved', this.handleEvolution as EventListener)
  }

  private handleEvolution = (e: CustomEvent<{ originalId: string; evolvedId: string }>): void => {
    const { originalId, evolvedId } = e.detail
    const originalName = SPELLS[originalId]?.name ?? originalId
    const evolvedName  = SPELLS[evolvedId]?.name  ?? evolvedId
    this.show(originalName, evolvedName)
  }

  private show(originalName: string, evolvedName: string): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId)
      this.root.innerHTML = ''
      this.root.classList.remove('visible')
      void this.root.offsetWidth
    }

    const spellEl = document.createElement('div')
    spellEl.className   = 'evolution-spell-name'
    spellEl.textContent = `${originalName} → ${evolvedName}`

    const labelEl = document.createElement('div')
    labelEl.className   = 'evolution-label'
    labelEl.textContent = 'SPELL EVOLVED'

    this.root.innerHTML = ''
    this.root.appendChild(spellEl)
    this.root.appendChild(labelEl)
    this.root.classList.add('visible')

    this.timerId = setTimeout(() => {
      this.root.classList.remove('visible')
      this.root.innerHTML = ''
      this.timerId = null
    }, EVOLUTION_OVERLAY_DURATION_S * 1000)
  }

  dispose(): void {
    if (this.timerId !== null) clearTimeout(this.timerId)
    window.removeEventListener('spellEvolved', this.handleEvolution as EventListener)
    this.root.innerHTML = ''
    this.root.classList.remove('visible')
  }
}
