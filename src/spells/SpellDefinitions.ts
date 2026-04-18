export interface Spell {
  id:          string
  name:        string
  element:     'fire' | 'ice' | 'lightning' | 'arcane'
  type:        'projectile' | 'aoe' | 'beam' | 'self'
  damage:      number
  manaCost:    number
  cooldown:    number   // seconds
  range:       number   // units
  speed?:      number   // units/sec — projectile only
  radius?:     number   // units — aoe only
  duration?:   number   // seconds — beam/dot only
  description: string
}

export const SPELLS: Record<string, Spell> = {
  fireball: {
    id:          'fireball',
    name:        'Fireball',
    element:     'fire',
    type:        'projectile',
    damage:      30,
    manaCost:    20,
    cooldown:    1.5,
    range:       20,
    speed:       12,
    description: 'A blazing sphere of fire that immolates enemies on contact.',
  },
}
