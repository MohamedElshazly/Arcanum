// src/dungeon/BiomeDefinitions.ts
import type { SpellElement } from '../spells/SpellDefinitions'

export type BiomeType = 'stone' | 'fire' | 'ice' | 'lightning' | 'arcane' | 'void'

export interface HazardDefinition {
  type: 'lava_patch' | 'ice_floor' | 'storm_zone' | 'void_rift'
  radius: number
  effect: 'damage_over_time' | 'slow' | 'random_knockback' | 'mana_drain'
  value: number
  color: string
}

export interface BiomeDefinition {
  type: BiomeType
  floorColor: string
  wallColor: string
  ambientLightColor: string
  ambientLightIntensity: number
  fogColor: string
  fogDensity: number
  dominantElement: SpellElement | null
  enemyElementWeights: Partial<Record<SpellElement, number>>
  hazards: HazardDefinition[]
  particleColor: string
  description: string
}

export const BIOMES: Record<BiomeType, BiomeDefinition> = {
  stone: {
    type: 'stone',
    floorColor: '#1a1a1a', wallColor: '#2a2a2a',
    ambientLightColor: '#ffffff', ambientLightIntensity: 0.4,
    fogColor: '#0a0a0a', fogDensity: 0.015,
    dominantElement: null,
    enemyElementWeights: { fire: 0.25, ice: 0.25, lightning: 0.25, arcane: 0.25 },
    hazards: [],
    particleColor: '#888888',
    description: 'Ancient stone corridors, cold and silent.',
  },
  fire: {
    type: 'fire',
    floorColor: '#1a0800', wallColor: '#2a1000',
    ambientLightColor: '#ff4400', ambientLightIntensity: 0.6,
    fogColor: '#1a0500', fogDensity: 0.02,
    dominantElement: 'fire',
    enemyElementWeights: { fire: 0.7, ice: 0.1, lightning: 0.1, arcane: 0.1 },
    hazards: [{ type: 'lava_patch', radius: 1.2, effect: 'damage_over_time', value: 8, color: '#ff6600' }],
    particleColor: '#ff8800',
    description: 'The air shimmers with heat. The walls weep molten rock.',
  },
  ice: {
    type: 'ice',
    floorColor: '#0a1520', wallColor: '#0d1f2d',
    ambientLightColor: '#aaddff', ambientLightIntensity: 0.4,
    fogColor: '#0a1525', fogDensity: 0.02,
    dominantElement: 'ice',
    enemyElementWeights: { fire: 0.1, ice: 0.7, lightning: 0.1, arcane: 0.1 },
    hazards: [{ type: 'ice_floor', radius: 1.5, effect: 'slow', value: 0.4, color: '#aaddff' }],
    particleColor: '#aaddff',
    description: 'Frost coats every surface. Your breath fogs the air.',
  },
  lightning: {
    type: 'lightning',
    floorColor: '#0f0f1a', wallColor: '#1a1a2a',
    ambientLightColor: '#ccccff', ambientLightIntensity: 0.8,
    fogColor: '#0a0a15', fogDensity: 0.015,
    dominantElement: 'lightning',
    enemyElementWeights: { fire: 0.1, ice: 0.1, lightning: 0.7, arcane: 0.1 },
    hazards: [{ type: 'storm_zone', radius: 2.0, effect: 'random_knockback', value: 5, color: '#ffff88' }],
    particleColor: '#ffff44',
    description: 'Static fills the air. Every surface hums with charge.',
  },
  arcane: {
    type: 'arcane',
    floorColor: '#0a0015', wallColor: '#150025',
    ambientLightColor: '#8800ff', ambientLightIntensity: 0.6,
    fogColor: '#050010', fogDensity: 0.025,
    dominantElement: 'arcane',
    enemyElementWeights: { fire: 0.1, ice: 0.1, lightning: 0.1, arcane: 0.7 },
    hazards: [{ type: 'void_rift', radius: 1.0, effect: 'mana_drain', value: 8, color: '#8800ff' }],
    particleColor: '#aa44ff',
    description: 'Reality feels thin here. Magic bends in unexpected ways.',
  },
  void: {
    type: 'void',
    floorColor: '#000000', wallColor: '#050005',
    ambientLightColor: '#330011', ambientLightIntensity: 0.8,
    fogColor: '#050005', fogDensity: 0.03,
    dominantElement: null,
    enemyElementWeights: { fire: 0.25, ice: 0.25, lightning: 0.25, arcane: 0.25 },
    hazards: [
      { type: 'lava_patch', radius: 1.2, effect: 'damage_over_time', value: 8, color: '#ff6600' },
      { type: 'ice_floor',  radius: 1.5, effect: 'slow',             value: 0.4, color: '#aaddff' },
      { type: 'storm_zone', radius: 2.0, effect: 'random_knockback', value: 5,   color: '#ffff88' },
      { type: 'void_rift',  radius: 1.0, effect: 'mana_drain',       value: 8,   color: '#8800ff' },
    ],
    particleColor: '#ff00ff',
    description: 'Something ancient waits here. The air tastes of endings.',
  },
}
