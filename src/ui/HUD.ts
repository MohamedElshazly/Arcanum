import type { Player }     from '../entities/Player'
import type { SpellCaster } from '../spells/SpellCaster'
import type { SpellBar }    from '../spells/SpellBar'

export class HUD {
  private hpFill!:       HTMLElement
  private manaFill!:     HTMLElement
  private barIndicator!: HTMLElement
  private bar1El!:       HTMLElement
  private bar2El!:       HTMLElement

  // [barIndex 0|1][slotIndex 0-3]
  private slots:     HTMLElement[][] = [[], []]
  private cooldowns: HTMLElement[][] = [[], []]
  private names:     HTMLElement[][] = [[], []]
  private costs:     HTMLElement[][] = [[], []]

  init(): void {
    this.hpFill       = document.getElementById('hp-fill')!
    this.manaFill     = document.getElementById('mana-fill')!
    this.barIndicator = document.getElementById('bar-indicator')!
    this.bar1El       = document.getElementById('bar-1')!
    this.bar2El       = document.getElementById('bar-2')!

    for (let i = 0; i < 4; i++) {
      this.slots[0].push(document.getElementById(`bar1-slot-${i}`)!)
      this.slots[1].push(document.getElementById(`bar2-slot-${i}`)!)
      this.cooldowns[0].push(document.getElementById(`bar1-cd-${i}`)!)
      this.cooldowns[1].push(document.getElementById(`bar2-cd-${i}`)!)
      this.names[0].push(document.getElementById(`bar1-name-${i}`)!)
      this.names[1].push(document.getElementById(`bar2-name-${i}`)!)
      this.costs[0].push(document.getElementById(`bar1-cost-${i}`)!)
      this.costs[1].push(document.getElementById(`bar2-cost-${i}`)!)
    }
  }

  update(player: Player, caster: SpellCaster, spellBar: SpellBar, currentTime: number): void {
    this.hpFill.style.width   = `${(player.hp   / player.maxHp)   * 100}%`
    this.manaFill.style.width = `${(player.mana  / player.maxMana) * 100}%`

    this.bar1El.className = 'spell-bar ' + (spellBar.activeBar === 1 ? 'active' : 'inactive')
    this.bar2El.className = 'spell-bar ' + (spellBar.activeBar === 2 ? 'active' : 'inactive')

    this.barIndicator.innerHTML = `BAR ${spellBar.activeBar}<br><span class="tab-hint">TAB</span>`

    const barArrays = [spellBar.bar1, spellBar.bar2]
    for (let b = 0; b < 2; b++) {
      for (let s = 0; s < 4; s++) {
        const spell = barArrays[b][s]
        const slot  = this.slots[b][s]
        const cd    = this.cooldowns[b][s]
        const name  = this.names[b][s]
        const cost  = this.costs[b][s]

        if (!spell) {
          slot.removeAttribute('data-element')
          name.textContent = ''
          cost.textContent = ''
          cd.style.height  = '0%'
          cd.textContent   = ''
          continue
        }

        slot.dataset.element = spell.element
        name.textContent     = spell.name.substring(0, 9)
        cost.textContent     = `${spell.manaCost}MP`

        const pct       = caster.getCooldownPercent(spell.id, currentTime)
        const remaining = caster.getCooldownRemaining(spell.id, currentTime)
        cd.style.height = `${pct * 100}%`
        cd.textContent  = remaining > 0.05 ? remaining.toFixed(1) : ''
      }
    }
  }

  /** Flash the slot briefly on successful cast. */
  onCastSuccess(barIndex: 0 | 1, slotIndex: number): void {
    const slot = this.slots[barIndex][slotIndex]
    slot.classList.remove('slot-flash')
    void (slot as HTMLElement).offsetWidth
    slot.classList.add('slot-flash')
    setTimeout(() => slot.classList.remove('slot-flash'), 150)
  }

  /** Shake the slot to signal mana failure or cooldown. */
  onCastFail(barIndex: 0 | 1, slotIndex: number): void {
    const slot = this.slots[barIndex][slotIndex]
    slot.classList.remove('slot-shake')
    void (slot as HTMLElement).offsetWidth
    slot.classList.add('slot-shake')
    setTimeout(() => slot.classList.remove('slot-shake'), 200)
  }

  /** Pulse the bar indicator when the active bar changes. */
  onBarToggle(): void {
    this.barIndicator.classList.remove('pulse')
    void (this.barIndicator as HTMLElement).offsetWidth
    this.barIndicator.classList.add('pulse')
    setTimeout(() => this.barIndicator.classList.remove('pulse'), 500)
  }
}
