import type { SpellElement } from '../spells/SpellDefinitions'

export const ELEMENT_COLORS: Record<SpellElement, string> = {
  fire: '#ff6600',
  ice: '#44aaff',
  lightning: '#ffff44',
  arcane: '#bb44ff',
}

export const ELEMENT_GRADIENTS: Record<SpellElement, [string, string]> = {
  fire: ['#ff6600', '#cc3300'],
  ice: ['#44aaff', '#2266cc'],
  lightning: ['#ffff44', '#ccaa00'],
  arcane: ['#bb44ff', '#7722aa'],
}

const ICONS: Record<string, string> = {
  // Fire
  fireball:     '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-1 4-4 6-4 10a4 4 0 008 0c0-4-3-6-4-10z"/></svg>',
  flame_lance:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 8h-4l2-8zM10 12v8a2 2 0 004 0v-8h-4z"/></svg>',
  ember_shot:   '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="10" r="2"/><circle cx="16" cy="8" r="2.5"/><circle cx="12" cy="15" r="3"/></svg>',
  pyroblast:    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1c-2 5-6 7-6 13a6 6 0 0012 0c0-6-4-8-6-13z"/><path d="M12 8c-1 3-3 4-3 7a3 3 0 006 0c0-3-2-4-3-7z" fill="rgba(255,255,255,0.3)"/></svg>',
  // Ice
  frost_bolt:   '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19"/></svg>',
  ice_wall:     '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="6" width="5" height="14" rx="1"/><rect x="10" y="4" width="5" height="16" rx="1"/><rect x="17" y="7" width="5" height="13" rx="1"/></svg>',
  frozen_nova:  '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/></svg>',
  glacial_spike:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 10h-6l3-10zM12 22l-3-10h6l-3 10z"/></svg>',
  // Lightning
  chain_lightning:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2L4 10h4l-2 6 9-10h-5l3-4z"/><path d="M15 8l-2 4h3l-5 10 2-6h-3l3-8z" opacity="0.6"/></svg>',
  thunder_clap: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 6a6 6 0 00-6 6h2a4 4 0 018 0h2a6 6 0 00-6-6z"/><path d="M12 2a10 10 0 00-10 10h2a8 8 0 0116 0h2a10 10 0 00-10-10z" opacity="0.5"/><rect x="11" y="14" width="2" height="8" rx="1"/></svg>',
  spark:        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>',
  static_field: '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none"><circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8M9 9l6 6M15 9l-6 6"/></svg>',
  // Arcane
  arcane_missile:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="2"/></svg>',
  blink:        '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="12" r="3" opacity="0.3"/><circle cx="16" cy="12" r="3"/><path d="M11 12h2" stroke="currentColor" stroke-width="1" stroke-dasharray="1 1"/></svg>',
  mana_siphon:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2c-4 4-4 8 0 10s0 6 0 10"/><path d="M12 2c4 4 4 8 0 10s0 6 0 10"/></svg>',
  arcane_explosion:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 2l1 5h-2zM12 22l-1-5h2zM2 12l5-1v2zM22 12l-5 1v-2zM5 5l4 3-1.5 1.5zM19 19l-4-3 1.5-1.5zM19 5l-3 4-1.5-1.5zM5 19l3-4 1.5 1.5z"/></svg>',
  // New spells
  meteor:         '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="14" cy="10" r="5"/><path d="M4 2l3 5-2 1 5 4-1-4 2-1z" opacity="0.6"/></svg>',
  burning_hands:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14l-6 8h12l-6-8z"/><path d="M8 16c-1-3 0-6 4-8 4 2 5 5 4 8" opacity="0.7"/></svg>',
  cone_of_cold:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14l-8 8h16l-8-8z"/><path d="M12 2v6M8 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
  ice_barrier:    '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></svg>',
  ball_lightning:  '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/><path d="M4 12h3M17 12h3M12 4v3M12 17v3" stroke="currentColor" stroke-width="1.5"/></svg>',
  thunderwave:    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 16a4 4 0 004-4h-8a4 4 0 004 4z"/><path d="M12 20a8 8 0 008-8H4a8 8 0 008 8z" opacity="0.4"/></svg>',
  arcane_orb:     '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><path d="M4 12h2M18 12h2" stroke="currentColor" stroke-width="1" stroke-dasharray="1 1"/></svg>',
  force_wall:     '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="4" height="16" rx="1"/><rect x="10" y="3" width="4" height="18" rx="1"/><rect x="16" y="5" width="4" height="14" rx="1"/></svg>',
}

const FALLBACK = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>'

export function getSpellIcon(spellId: string): string {
  return ICONS[spellId] ?? FALLBACK
}
