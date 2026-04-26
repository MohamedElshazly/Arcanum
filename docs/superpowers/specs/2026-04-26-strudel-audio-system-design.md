# Strudel Audio System — Design

**Date:** 2026-04-26
**Status:** Approved (pending implementation plan)

## Goal

Add atmospheric per-biome music, a dedicated boss track, and per-element spell SFX to Arcanum. Music and SFX are composed in [Strudel](https://strudel.cc) (browser live-coding environment), pre-rendered to `.ogg` files, and played through a thin in-engine audio layer. The game itself never depends on Strudel at runtime.

## Scope

In scope:
- 7 looping music tracks (6 biomes + 1 boss)
- 9 spell SFX (4 elements × {cast, impact} + 1 utility)
- `MusicManager` and `SfxManager` runtime managers backed by Howler.js
- Volume controls (master / music / sfx / mute) persisted to `localStorage`
- Audio panel in the existing options/spellbook screen
- Strudel pattern sources checked into the repo for archival/iteration

Out of scope:
- Reactive musical layers (combat-intensity layers, phase-driven mixing)
- Per-spell unique SFX (deferred — current design uses element × type)
- Footstep, impact, ambient environmental SFX
- UI sounds (button clicks, menu navigation)
- Voice acting or narration

## High-Level Architecture

**Composition workflow (offline):**
Compose tracks and SFX in [strudel.cc](https://strudel.cc) → record via Strudel's built-in recorder to `.wav` → convert to `.ogg` (96kbps for music, 128kbps for SFX) via `ffmpeg` → place in `public/audio/`. The `.strudel` source files are checked into `docs/audio/strudel/` so any track can be reproduced or iterated.

**Runtime architecture:**
Two singleton managers built on **Howler.js** (~30kb gzipped, mature crossfade and pooling support):
- `MusicManager` — owns the current and queued music track. API: `play(track)`, `crossfadeTo(track, durationSeconds)`, `stopWithSilence(durationSeconds)`, `unlock()`, `setMasterVolume`, `setMusicVolume`.
- `SfxManager` — fires short sounds with overlap-safe pooling. API: `play(element, phase)` where `element ∈ {fire, ice, lightning, arcane}` and `phase ∈ {cast, impact, utility}`. When `phase === 'utility'`, `element` is ignored — there is one shared `utility.ogg`. Plus `setSfxVolume`.

Both managers receive a small audio-backend interface in their constructor (`{ load, play, fade, stop, setVolume }`) so tests can inject a fake and the production wiring uses Howler. No globals — both managers are instantiated in `Game.ts` and passed by reference into `DungeonSession` and `SpellCaster`.

**Volume persistence:**
Stored under the `localStorage` key `arcanum.audio` as `{ master: number, music: number, sfx: number, muted: boolean }`. Read on `MusicManager` / `SfxManager` construction; written on each setter call.

## File Layout

```
public/audio/
  music/
    stone.ogg      ~1.5MB
    fire.ogg
    ice.ogg
    lightning.ogg
    arcane.ogg
    void.ogg
    boss.ogg
  sfx/
    fire_cast.ogg       ~80KB
    fire_impact.ogg
    ice_cast.ogg
    ice_impact.ogg
    lightning_cast.ogg
    lightning_impact.ogg
    arcane_cast.ogg
    arcane_impact.ogg
    utility.ogg

docs/audio/strudel/
  _template.strudel       (shared conventions — BPM ranges, palette guidance)
  stone.strudel
  fire.strudel
  ice.strudel
  lightning.strudel
  arcane.strudel
  void.strudel
  boss.strudel
  sfx/
    fire_cast.strudel
    ... (9 sfx sources)

src/audio/
  MusicManager.ts
  SfxManager.ts
  AudioBackend.ts         (interface + Howler-backed implementation)
  index.ts                (re-exports + factory)

tests/
  MusicManager.test.ts
  SfxManager.test.ts
```

**Total file budget:** ~11MB added to `public/` (10.5MB music + 0.7MB SFX). Reasonable for a web game with a loading/difficulty-selection screen.

## Integration Points

### Music triggers

| Event                         | File                                                                                | Action                                            |
|-------------------------------|-------------------------------------------------------------------------------------|---------------------------------------------------|
| Biome change (room entry)     | [src/dungeon/DungeonSession.ts:256](src/dungeon/DungeonSession.ts#L256)             | `crossfadeTo(biome, 1.5s)`                        |
| Boss room entered             | [src/dungeon/DungeonSession.ts](src/dungeon/DungeonSession.ts) (boss-room detection)| `stopWithSilence(0.5s)` (current track fades over 500ms) → 400ms of full silence → `play('boss')`. Total dramatic gap ≈ 900ms. |
| Boss defeated                 | [src/dungeon/DungeonSession.ts:183](src/dungeon/DungeonSession.ts#L183) (`onEnemyDied`, gate on `boss.isBoss`) | `crossfadeTo(currentBiome, 1.5s)` |
| Player death / game-over      | [src/core/Game.ts](src/core/Game.ts) death handler                                  | `stopWithSilence(0.3s)` — no music on death screen |
| Difficulty selected (game start) | [src/core/Game.ts](src/core/Game.ts) start handler                               | `unlock()` then `play(initialBiome)`              |

The boss-room detection field name will be confirmed at implementation time (likely `room.kind === 'boss'` or via the existing `isBoss` getter on enemies). If neither exists, gating off "current room contains an enemy with `isBoss === true`" is a fallback.

### SFX triggers

| Event                | File                                                            | Action                                              |
|----------------------|-----------------------------------------------------------------|-----------------------------------------------------|
| Spell cast (any type)| [src/spells/SpellCaster.ts](src/spells/SpellCaster.ts) cast site| `play(spell.element, spell.type === 'self' ? 'utility' : 'cast')` |
| Projectile impact    | [src/entities/Projectile.ts](src/entities/Projectile.ts) on damage / destroy | `play(spell.element, 'impact')`     |
| AOE spell            | Same as cast trigger                                            | Fire `cast` immediately, schedule `impact` 50ms later (single tick) for layered feel |
| Beam spell           | Same as cast trigger                                            | Fire `cast` only (no impact — beam has continuous contact, not a single hit moment) |

### Volume controls

A new audio panel inside the existing Spellbook/options UI:
- 3 sliders: master, music, sfx (0.0–1.0 each, 0.05 step)
- 1 mute toggle (overrides all sliders, preserves slider values)
- Live preview: moving a slider takes effect immediately

## Composition Guidelines

A `_template.strudel` file documents shared conventions so the 7 tracks feel like part of the same album:

- **BPM:** biome tracks 70–90, boss 110–130
- **Length:** all music tracks loop seamlessly at 60–90 seconds
- **Stone biome:** sparse, reverby, low-mid tones — distant church bells, slow pulse
- **Fire biome:** crackly textures, warm bass, urgent hi-hats — drives forward
- **Ice biome:** crystalline plucks, sustained pads, slow filter sweeps
- **Lightning biome:** rhythmic stutters, glitchy hi-hats, electric squelches
- **Arcane biome:** detuned chords, warbly leads, off-grid percussion
- **Void biome:** dissonant pads, deep sub-bass, sparse — feels of dread
- **Boss:** higher BPM, all four elemental textures layered briefly, drum-driven

Each SFX is short (≤ 0.4s for cast, ≤ 0.6s for impact) and clearly element-flavored. Cast SFX have a quick attack and decay; impact SFX hit harder with more low-end body.

## Loading & Autoplay

**Autoplay policy:** Modern browsers block audio until a user gesture. The "select difficulty" button at game start is our gesture — `MusicManager.unlock()` resumes Howler's `AudioContext` from that click handler. Calls to `play()` before unlock are queued and start once unlocked.

**Preload strategy:**
- **SFX:** preload all 9 at startup (small files, must be instant).
- **Music:** preload current biome track + boss track at startup. Lazy-load other biomes on first entry, keep cached for the rest of the run. Eviction: never (the budget is tiny).

**Decoding cost:** Howler decodes on first play, not on `Howl` construction, so preloading is fast (network only).

## Testing Approach

**Unit-testable (Vitest, fake backend):**
- `MusicManager` state machine: which track is `current` / `queued` after each method, crossfade math (volume curves over time when ticked manually), `stopWithSilence` schedules the next play correctly.
- Volume persistence: `localStorage` round-trip; loaded values respected on construction; setters update `localStorage`.
- `SfxManager` element→file mapping: every `(element, phase)` combo resolves to the expected file path.
- Mute toggle preserves underlying slider values.

**Manual-only:**
- Crossfade smoothness, perceived mix levels, autoplay unlock, browser-specific decoding bugs.
- Boss music timing feel (0.5s silence + 0.4s pause + boss kick).

The plan must include manual visual/audio smoke checks at integration points 1, 2, 4, 6 (music biome change, music boss start, music boss end, spell cast SFX).

## Risks & Open Questions

1. **Strudel record latency:** Strudel's record button captures real-time playback, so a 60-second loop takes 60 seconds to record. Acceptable but slow for iteration. Mitigation: keep loops short during composition, lengthen for final render.
2. **Loop seamlessness:** Strudel patterns naturally loop on bar boundaries, but recorded `.ogg` files may have a click at the loop point unless trimmed precisely. Mitigation: pad recording with one extra bar, then trim to bar boundary in audio editor (Audacity / ffmpeg `-ss` and `-to`).
3. **Howler bundle size:** ~30kb gzipped. Acceptable.
4. **Mobile autoplay:** iOS in particular is strict about audio context unlocks. Test early on a real iPhone if mobile is a target.
5. **Boss-room detection field name:** to be confirmed during planning by reading the room/dungeon types. Fallback path (gating off `isBoss` enemy presence) works either way.

## Success Criteria

- All 6 biomes have distinct, looping music; boss rooms swap to the boss track with the silence-then-kick transition.
- All four spell elements have audibly distinct cast and impact sounds.
- Volume sliders persist across sessions; mute is instant and reversible.
- No audible click at music loop points.
- No audio plays before the player clicks "start" (autoplay-policy compliant).
- Bundle size adds < 50kb gzipped JS (Howler + managers).
- Unit tests pass for both managers' state and volume behavior.
