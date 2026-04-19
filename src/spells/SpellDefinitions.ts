export type SpellElement = 'fire' | 'ice' | 'lightning' | 'arcane'
export type SpellType    = 'projectile' | 'aoe' | 'beam' | 'self'
export type StatusEffectType = 'burning' | 'slow' | 'freeze' | 'stun' | 'knockback'

export interface StatusEffect {
  type: StatusEffectType
  duration: number
  value?: number
}

export interface Spell {
  id:                 string
  name:               string
  element:            SpellElement
  type:               SpellType
  damage:             number
  manaCost:           number
  cooldown:           number
  range:              number
  speed?:             number
  radius?:            number
  duration?:          number
  statusEffect?:      StatusEffect
  description:        string
  masteryEvolvesTo?:  string
  projectileGeometry: 'sphere' | 'cone' | 'cylinder' | 'ring' | 'spike'
  projectileScale:    { x: number; y: number; z: number }
  color:              string
  emissiveColor:      string
  emissiveIntensity:  number
}

export const SPELLS: Record<string, Spell> = {
  // ── FIRE ─────────────────────────────────────────────────────────────────
  fireball: {
    id: 'fireball', name: 'Fireball', element: 'fire', type: 'projectile',
    damage: 30, manaCost: 20, cooldown: 1.5, range: 20, speed: 12,
    description: 'A blazing sphere of fire that immolates enemies on contact.',
    masteryEvolvesTo: 'pyroblast',
    projectileGeometry: 'sphere', projectileScale: { x: 1, y: 1, z: 1 },
    color: '#ff6600', emissiveColor: '#ff4400', emissiveIntensity: 1.5,
  },
  flame_lance: {
    id: 'flame_lance', name: 'Flame Lance', element: 'fire', type: 'projectile',
    damage: 45, manaCost: 30, cooldown: 2.0, range: 18, speed: 20,
    description: 'A piercing lance of concentrated flame.',
    projectileGeometry: 'cylinder', projectileScale: { x: 0.2, y: 3, z: 0.2 },
    color: '#cc2200', emissiveColor: '#ff0000', emissiveIntensity: 2.0,
  },
  ember_shot: {
    id: 'ember_shot', name: 'Ember Shot', element: 'fire', type: 'projectile',
    damage: 12, manaCost: 8, cooldown: 0.4, range: 15, speed: 22,
    description: 'A rapid burst of burning embers.',
    masteryEvolvesTo: 'flame_lance',
    projectileGeometry: 'sphere', projectileScale: { x: 0.3, y: 0.3, z: 0.3 },
    color: '#ffaa00', emissiveColor: '#ffcc00', emissiveIntensity: 2.5,
  },
  pyroblast: {
    id: 'pyroblast', name: 'Pyroblast', element: 'fire', type: 'projectile',
    damage: 80, manaCost: 55, cooldown: 6.0, range: 15, speed: 7, radius: 3.0,
    description: 'A massive fireball that erupts in a wide explosion.',
    projectileGeometry: 'sphere', projectileScale: { x: 2, y: 2, z: 2 },
    color: '#990000', emissiveColor: '#ff4400', emissiveIntensity: 1.0,
  },

  // ── ICE ──────────────────────────────────────────────────────────────────
  frost_bolt: {
    id: 'frost_bolt', name: 'Frost Bolt', element: 'ice', type: 'projectile',
    damage: 25, manaCost: 15, cooldown: 1.2, range: 18, speed: 10,
    statusEffect: { type: 'slow', duration: 2.0, value: 0.5 },
    description: 'A shard of ice that slows its target.',
    masteryEvolvesTo: 'glacial_spike',
    projectileGeometry: 'cone', projectileScale: { x: 0.4, y: 1.5, z: 0.4 },
    color: '#aaddff', emissiveColor: '#00ccff', emissiveIntensity: 1.0,
  },
  ice_wall: {
    id: 'ice_wall', name: 'Ice Wall', element: 'ice', type: 'aoe',
    damage: 0, manaCost: 30, cooldown: 8.0, range: 5, duration: 4.0,
    description: 'Raises a wall of ice that blocks passage.',
    projectileGeometry: 'cylinder', projectileScale: { x: 0.5, y: 2, z: 0.5 },
    color: '#aaddff', emissiveColor: '#00ffff', emissiveIntensity: 0.5,
  },
  frozen_nova: {
    id: 'frozen_nova', name: 'Frozen Nova', element: 'ice', type: 'aoe',
    damage: 30, manaCost: 35, cooldown: 4.0, range: 5, radius: 5.0,
    statusEffect: { type: 'freeze', duration: 1.5 },
    description: 'An icy shockwave that freezes all nearby enemies.',
    projectileGeometry: 'ring', projectileScale: { x: 1, y: 1, z: 0.2 },
    color: '#ffffff', emissiveColor: '#00ccff', emissiveIntensity: 2.0,
  },
  glacial_spike: {
    id: 'glacial_spike', name: 'Glacial Spike', element: 'ice', type: 'projectile',
    damage: 50, manaCost: 25, cooldown: 2.5, range: 20, speed: 14,
    statusEffect: { type: 'stun', duration: 0.5 },
    description: 'A massive spike of ice that stuns on impact.',
    projectileGeometry: 'spike', projectileScale: { x: 0.3, y: 2, z: 0.3 },
    color: '#88ccff', emissiveColor: '#aaddff', emissiveIntensity: 1.5,
  },

  // ── LIGHTNING ─────────────────────────────────────────────────────────────
  chain_lightning: {
    id: 'chain_lightning', name: 'Chain Ltng', element: 'lightning', type: 'projectile',
    damage: 25, manaCost: 20, cooldown: 1.5, range: 18, speed: 18,
    description: 'Electricity that jumps between up to 3 enemies.',
    projectileGeometry: 'cylinder', projectileScale: { x: 0.1, y: 1, z: 0.1 },
    color: '#ffff00', emissiveColor: '#ffff00', emissiveIntensity: 3.0,
  },
  thunder_clap: {
    id: 'thunder_clap', name: 'Thunder Clap', element: 'lightning', type: 'aoe',
    damage: 40, manaCost: 35, cooldown: 4.0, range: 5, radius: 5.0,
    statusEffect: { type: 'stun', duration: 0.5 },
    description: 'A thunderous shockwave that stuns nearby enemies.',
    projectileGeometry: 'ring', projectileScale: { x: 3, y: 3, z: 0.3 },
    color: '#ffffff', emissiveColor: '#ffffff', emissiveIntensity: 2.0,
  },
  spark: {
    id: 'spark', name: 'Spark', element: 'lightning', type: 'projectile',
    damage: 8, manaCost: 5, cooldown: 0.25, range: 20, speed: 28,
    description: 'A tiny bolt of lightning — cheap, fast, weak.',
    masteryEvolvesTo: 'chain_lightning',
    projectileGeometry: 'sphere', projectileScale: { x: 0.2, y: 0.2, z: 0.2 },
    color: '#ffff44', emissiveColor: '#ffff00', emissiveIntensity: 3.0,
  },
  static_field: {
    id: 'static_field', name: 'Static Field', element: 'lightning', type: 'aoe',
    damage: 15, manaCost: 40, cooldown: 10.0, range: 8, radius: 4.0, duration: 5.0,
    description: 'A persistent electric zone that zaps enemies every 0.5s.',
    projectileGeometry: 'ring', projectileScale: { x: 1, y: 1, z: 0.1 },
    color: '#ffff88', emissiveColor: '#ffff00', emissiveIntensity: 1.5,
  },

  // ── ARCANE ────────────────────────────────────────────────────────────────
  arcane_missile: {
    id: 'arcane_missile', name: 'Arc. Missile', element: 'arcane', type: 'projectile',
    damage: 20, manaCost: 12, cooldown: 0.8, range: 22, speed: 10,
    description: 'A homing missile of pure arcane energy.',
    masteryEvolvesTo: 'arcane_explosion',
    projectileGeometry: 'sphere', projectileScale: { x: 0.3, y: 0.8, z: 0.3 },
    color: '#aa44ff', emissiveColor: '#8800ff', emissiveIntensity: 2.0,
  },
  blink: {
    id: 'blink', name: 'Blink', element: 'arcane', type: 'self',
    damage: 0, manaCost: 20, cooldown: 3.0, range: 5,
    description: 'Teleport 5 units in your movement direction.',
    projectileGeometry: 'sphere', projectileScale: { x: 0.5, y: 0.5, z: 0.5 },
    color: '#ffffff', emissiveColor: '#ffffff', emissiveIntensity: 1.0,
  },
  mana_siphon: {
    id: 'mana_siphon', name: 'Mana Siphon', element: 'arcane', type: 'beam',
    damage: 12, manaCost: 0, cooldown: 2.0, range: 8, duration: 2.0,
    description: 'A beam that drains enemy health and restores your mana.',
    projectileGeometry: 'cylinder', projectileScale: { x: 0.15, y: 1, z: 0.15 },
    color: '#ff44ff', emissiveColor: '#ff00ff', emissiveIntensity: 2.0,
  },
  arcane_explosion: {
    id: 'arcane_explosion', name: 'Arc. Explode', element: 'arcane', type: 'aoe',
    damage: 60, manaCost: 45, cooldown: 5.0, range: 6, radius: 6.0,
    description: 'A massive arcane detonation centred on the caster.',
    projectileGeometry: 'ring', projectileScale: { x: 4, y: 4, z: 0.2 },
    color: '#dd88ff', emissiveColor: '#aa00ff', emissiveIntensity: 2.0,
  },
}
