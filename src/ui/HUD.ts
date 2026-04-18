import type { Player }      from '../entities/Player'
import type { SpellCaster } from '../spells/SpellCaster'

export class HUD {
  private hpFill!:       HTMLElement
  private manaFill!:     HTMLElement
  private qCooldown!:    HTMLElement

  init(): void {
    this.hpFill    = document.getElementById('hp-fill')!
    this.manaFill  = document.getElementById('mana-fill')!
    this.qCooldown = document.getElementById('q-cooldown')!
  }

  update(player: Player, caster: SpellCaster): void {
    this.hpFill.style.width    = `${(player.hp   / player.maxHp)   * 100}%`
    this.manaFill.style.width  = `${(player.mana / player.maxMana) * 100}%`
    this.qCooldown.style.height = `${caster.getCooldownRatio('fireball') * 100}%`
  }
}
