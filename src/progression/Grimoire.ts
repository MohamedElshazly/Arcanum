import { SPELLS } from '../spells/SpellDefinitions'
import {
  GRIMOIRE_FIRE_THRESHOLD_1, GRIMOIRE_FIRE_THRESHOLD_2,
  GRIMOIRE_ICE_THRESHOLD_1,  GRIMOIRE_ICE_THRESHOLD_2,
  GRIMOIRE_LIGHTNING_THRESHOLD_1, GRIMOIRE_LIGHTNING_THRESHOLD_2,
  GRIMOIRE_ARCANE_THRESHOLD_1,    GRIMOIRE_ARCANE_THRESHOLD_2,
  GRIMOIRE_TOTAL_THRESHOLD_1, GRIMOIRE_TOTAL_THRESHOLD_2, GRIMOIRE_TOTAL_THRESHOLD_3,
  GRIMOIRE_FIRE_BURNING_DAMAGE,
  GRIMOIRE_ICE_SLOW_DURATION, GRIMOIRE_ICE_FREEZE_CHANCE,
  GRIMOIRE_LIGHTNING_CHAIN_BOUNCES, GRIMOIRE_LIGHTNING_STUN_CHANCE,
  GRIMOIRE_ARCANE_BLINK_COOLDOWN, GRIMOIRE_ARCANE_HOMING_STRENGTH,
  GRIMOIRE_MANA_COST_REDUCTION, GRIMOIRE_COOLDOWN_REDUCTION, GRIMOIRE_DAMAGE_BONUS,
} from '../constants'

export type PassiveType =
  | 'fire_apply_burning'
  | 'fire_burning_damage'
  | 'ice_slow_duration'
  | 'ice_freeze_chance'
  | 'lightning_chain_bounces'
  | 'lightning_stun_chance'
  | 'arcane_blink_cooldown'
  | 'arcane_homing_strength'
  | 'all_mana_cost_reduction'
  | 'all_cooldown_reduction'
  | 'all_damage_bonus'

export interface GrimoirePassive {
  id:          string
  type:        PassiveType
  description: string
  element:     'fire' | 'ice' | 'lightning' | 'arcane' | 'all'
  value:       number
}

const STORAGE_KEY_BOOKS    = 'grimoire_absorbed_books'
const STORAGE_KEY_PASSIVES = 'grimoire_passives'

export class Grimoire {
  private absorbedBooks:  string[]          = []
  private activePassives: GrimoirePassive[] = []

  load(): void {
    const rawBooks = localStorage.getItem(STORAGE_KEY_BOOKS)
    if (rawBooks) this.absorbedBooks = JSON.parse(rawBooks) as string[]
    this.computePassives()
  }

  save(): void {
    localStorage.setItem(STORAGE_KEY_BOOKS,    JSON.stringify(this.absorbedBooks))
    localStorage.setItem(STORAGE_KEY_PASSIVES, JSON.stringify(this.activePassives))
  }

  absorbBook(spellIds: string[]): void {
    this.absorbedBooks.push(...spellIds)
    this.computePassives()
    this.save()
  }

  computePassives(): void {
    const fireCount      = this.absorbedBooks.filter(id => SPELLS[id]?.element === 'fire').length
    const iceCount       = this.absorbedBooks.filter(id => SPELLS[id]?.element === 'ice').length
    const lightningCount = this.absorbedBooks.filter(id => SPELLS[id]?.element === 'lightning').length
    const arcaneCount    = this.absorbedBooks.filter(id => SPELLS[id]?.element === 'arcane').length
    const totalCount     = this.absorbedBooks.length

    const passives: GrimoirePassive[] = []

    if (fireCount >= GRIMOIRE_FIRE_THRESHOLD_1) {
      passives.push({ id: 'fire_apply_burning', type: 'fire_apply_burning', element: 'fire', value: 1,
        description: 'Fire spells apply Burning on hit' })
    }
    if (fireCount >= GRIMOIRE_FIRE_THRESHOLD_2) {
      passives.push({ id: 'fire_burning_damage', type: 'fire_burning_damage', element: 'fire', value: GRIMOIRE_FIRE_BURNING_DAMAGE,
        description: `Burning deals +${GRIMOIRE_FIRE_BURNING_DAMAGE} extra damage per tick` })
    }
    if (iceCount >= GRIMOIRE_ICE_THRESHOLD_1) {
      passives.push({ id: 'ice_slow_duration', type: 'ice_slow_duration', element: 'ice', value: GRIMOIRE_ICE_SLOW_DURATION,
        description: `Slow duration +${GRIMOIRE_ICE_SLOW_DURATION}s` })
    }
    if (iceCount >= GRIMOIRE_ICE_THRESHOLD_2) {
      passives.push({ id: 'ice_freeze_chance', type: 'ice_freeze_chance', element: 'ice', value: GRIMOIRE_ICE_FREEZE_CHANCE,
        description: `${GRIMOIRE_ICE_FREEZE_CHANCE * 100}% chance to Freeze instead of Slow` })
    }
    if (lightningCount >= GRIMOIRE_LIGHTNING_THRESHOLD_1) {
      passives.push({ id: 'lightning_chain_bounces', type: 'lightning_chain_bounces', element: 'lightning', value: GRIMOIRE_LIGHTNING_CHAIN_BOUNCES,
        description: `Chain Lightning bounces +${GRIMOIRE_LIGHTNING_CHAIN_BOUNCES} more time` })
    }
    if (lightningCount >= GRIMOIRE_LIGHTNING_THRESHOLD_2) {
      passives.push({ id: 'lightning_stun_chance', type: 'lightning_stun_chance', element: 'lightning', value: GRIMOIRE_LIGHTNING_STUN_CHANCE,
        description: `${GRIMOIRE_LIGHTNING_STUN_CHANCE * 100}% chance to stun on lightning hit` })
    }
    if (arcaneCount >= GRIMOIRE_ARCANE_THRESHOLD_1) {
      passives.push({ id: 'arcane_blink_cooldown', type: 'arcane_blink_cooldown', element: 'arcane', value: GRIMOIRE_ARCANE_BLINK_COOLDOWN,
        description: `Blink cooldown -${GRIMOIRE_ARCANE_BLINK_COOLDOWN}s` })
    }
    if (arcaneCount >= GRIMOIRE_ARCANE_THRESHOLD_2) {
      passives.push({ id: 'arcane_homing_strength', type: 'arcane_homing_strength', element: 'arcane', value: GRIMOIRE_ARCANE_HOMING_STRENGTH,
        description: `Homing spells turn ${GRIMOIRE_ARCANE_HOMING_STRENGTH * 100}% faster` })
    }
    if (totalCount >= GRIMOIRE_TOTAL_THRESHOLD_1) {
      passives.push({ id: 'all_mana_cost_reduction', type: 'all_mana_cost_reduction', element: 'all', value: GRIMOIRE_MANA_COST_REDUCTION,
        description: `All spell mana costs -${GRIMOIRE_MANA_COST_REDUCTION * 100}%` })
    }
    if (totalCount >= GRIMOIRE_TOTAL_THRESHOLD_2) {
      passives.push({ id: 'all_cooldown_reduction', type: 'all_cooldown_reduction', element: 'all', value: GRIMOIRE_COOLDOWN_REDUCTION,
        description: `All cooldowns -${GRIMOIRE_COOLDOWN_REDUCTION * 100}%` })
    }
    if (totalCount >= GRIMOIRE_TOTAL_THRESHOLD_3) {
      passives.push({ id: 'all_damage_bonus', type: 'all_damage_bonus', element: 'all', value: GRIMOIRE_DAMAGE_BONUS,
        description: `All spell damage +${GRIMOIRE_DAMAGE_BONUS * 100}%` })
    }

    this.activePassives = passives
  }

  getActivePassives(): GrimoirePassive[] { return this.activePassives }

  getPassiveValue(type: PassiveType): number {
    return this.activePassives.find(p => p.type === type)?.value ?? 0
  }

  hasPassive(type: PassiveType): boolean {
    return this.activePassives.some(p => p.type === type)
  }

  getAbsorbedCount(): number { return this.absorbedBooks.length }
}
