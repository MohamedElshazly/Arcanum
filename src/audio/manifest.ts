import type { BiomeType } from '../dungeon/BiomeDefinitions'
import type { SpellElement } from '../spells/SpellDefinitions'

export type TrackId = BiomeType | 'boss'

export const MUSIC_FILES: Record<TrackId, string> = {
  stone:     '/audio/music/stone.ogg',
  fire:      '/audio/music/fire.ogg',
  ice:       '/audio/music/ice.ogg',
  lightning: '/audio/music/lightning.ogg',
  arcane:    '/audio/music/arcane.ogg',
  void:      '/audio/music/void.ogg',
  boss:      '/audio/music/boss.ogg',
}

export type SfxPhase = 'cast' | 'impact' | 'utility'

/** Returns the public URL for a (element, phase) SFX. Element ignored when phase is 'utility'. */
export function sfxFile(element: SpellElement, phase: SfxPhase): string {
  if (phase === 'utility') return '/audio/sfx/utility.ogg'
  return `/audio/sfx/${element}_${phase}.ogg`
}

export const ALL_SFX_FILES: string[] = [
  ...(['fire', 'ice', 'lightning', 'arcane'] as const).flatMap(e => [
    `/audio/sfx/${e}_cast.ogg`,
    `/audio/sfx/${e}_impact.ogg`,
  ]),
  '/audio/sfx/utility.ogg',
]
