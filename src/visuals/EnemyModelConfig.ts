import type { WizardModelConfig } from './WizardModel'
import type { EnemyArchetype, BossVariant } from '../entities/Enemy'
import { BOSS_VARIANTS } from '../entities/Enemy'

/** Build a WizardModelConfig for an enemy. `dominantColor` is the spell-element tint. */
export function getEnemyModelConfig(
  archetype: EnemyArchetype,
  dominantColor: number,
  bossVariant?: BossVariant,
): WizardModelConfig {
  if (archetype === 'boss') {
    const v = BOSS_VARIANTS[bossVariant ?? 'archlich']
    return {
      bodyColor:         v.meshColor,
      accentColor:       v.emissiveColor,
      hatColor:          v.meshColor,
      orbColor:          v.emissiveColor,
      height:            v.geometry[2],
      radius:            v.geometry[1],
      emissiveIntensity: 1.2,
    }
  }
  if (archetype === 'warlock') {
    return {
      bodyColor:         dominantColor,
      accentColor:       0xeeeeff,
      hatColor:          0x110011,
      orbColor:          dominantColor,
      height:            2.0,
      radius:            0.5,
      emissiveIntensity: 0.9,
    }
  }
  if (archetype === 'battle_mage') {
    return {
      bodyColor:         dominantColor,
      accentColor:       0xcccccc,
      hatColor:          0x222222,
      orbColor:          dominantColor,
      height:            1.8,
      radius:            0.55,
      emissiveIntensity: 0.6,
    }
  }
  // apprentice
  return {
    bodyColor:         dominantColor,
    accentColor:       0xddddee,
    hatColor:          0x333355,
    orbColor:          dominantColor,
    height:            1.4,
    radius:            0.4,
    emissiveIntensity: 0.5,
  }
}
