# Strudel Audio System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add looping per-biome music, a dedicated boss track, and per-element spell SFX, all composed in Strudel and pre-rendered to `.ogg` files played through a thin Howler-backed in-engine layer.

**Architecture:** Two singleton managers (`MusicManager`, `SfxManager`) in a new `src/audio/` module. Both depend on a small `AudioBackend` interface so unit tests can run against a fake while production wiring uses Howler. A separate `AudioStore` handles `localStorage` persistence of master/music/sfx volume sliders. Engine wiring: `MusicManager` is constructed in `Game.ts` and ticked from the main loop; biome changes / boss-room entry / boss death / player death drive its state. `SfxManager` is passed into `SpellCaster` and `Projectile` for per-spell sound effects.

**Tech Stack:** TypeScript, Three.js (existing), Vitest (existing), Howler.js 2.x (new), Strudel (offline composition only — never imported by the game).

**Spec:** See [docs/superpowers/specs/2026-04-26-strudel-audio-system-design.md](../specs/2026-04-26-strudel-audio-system-design.md)

---

## File Structure

**New files:**
- `src/audio/AudioBackend.ts` — interface defining `load / play / stop / setVolume / unlock`, plus a Howler-backed implementation
- `src/audio/AudioStore.ts` — typed wrapper around `localStorage` for persisted volume state
- `src/audio/MusicManager.ts` — current/queued track state, crossfade math, silence-then-play, master+music volume application
- `src/audio/SfxManager.ts` — `(element, phase) → file` lookup, overlap-safe firing, sfx volume application
- `src/audio/manifest.ts` — pure data: list of `TrackId` and SFX file IDs and their public URLs
- `src/audio/index.ts` — factory `createAudio(backend?)` returning `{ music, sfx }` for `Game.ts` wiring
- `src/ui/AudioPanel.ts` — DOM panel rendered inside the Spellbook overlay; 3 sliders + mute toggle
- `tests/AudioStore.test.ts`
- `tests/MusicManager.test.ts`
- `tests/SfxManager.test.ts`
- `tests/FakeAudioBackend.ts` — shared test fake (not a `.test.ts` so vitest doesn't auto-run it)

**Modified files:**
- `package.json` — add `howler` runtime dep + `@types/howler` dev dep
- `src/core/Game.ts` — instantiate audio managers, unlock + start music after difficulty selection, tick `MusicManager` in the main loop, stop music on death
- `src/dungeon/DungeonSession.ts` — fire `crossfadeTo(biome)` on biome change, `stopWithSilence` + `play('boss')` on boss-room entry, `crossfadeTo(biome)` on boss defeat
- `src/spells/SpellCaster.ts` — call `sfx.play(spell.element, ...)` at the start of `cast()` after mana/cooldown checks pass
- `src/entities/Projectile.ts` — call `sfx.play(spell.element, 'impact')` inside `destroy()`
- `src/ui/Spellbook.ts` — host the new audio panel inside the existing overlay

**New asset paths (placeholder silent files until composed):**
- `public/audio/music/{stone,fire,ice,lightning,arcane,void,boss}.ogg`
- `public/audio/sfx/{fire,ice,lightning,arcane}_{cast,impact}.ogg`
- `public/audio/sfx/utility.ogg`
- `docs/audio/strudel/_template.strudel`
- `docs/audio/strudel/stone.strudel` (one example to validate the workflow)
- `docs/audio/strudel/README.md` (composition + ffmpeg export workflow)

---

## Task 1: Set up worktree and install Howler

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (auto)

- [ ] **Step 1: Create isolated worktree**

```bash
cd /Users/omni/repos/arcanum
git worktree add .worktrees/strudel-audio -b feature/strudel-audio
cd .worktrees/strudel-audio
npm install
```

Expected: worktree created, `npm install` runs clean.

- [ ] **Step 2: Install Howler runtime + types**

```bash
npm install howler@^2.2.4
npm install --save-dev @types/howler@^2.2.12
```

Expected: both packages added to `package.json`. `package-lock.json` updated.

- [ ] **Step 3: Verify clean baseline**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: typecheck clean. Vitest reports the 1 pre-existing `SpellDefinitions` failure (24 vs 16 spells) and all other tests passing.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install howler for audio playback"
```

---

## Task 2: Audio asset placeholders + Strudel workflow doc

We need real on-disk files (even if silent) so dev-time integration testing works. We also commit a template + workflow doc so the user can compose tracks any time.

**Files:**
- Create: `public/audio/music/{stone,fire,ice,lightning,arcane,void,boss}.ogg` (silent 1-second placeholders)
- Create: `public/audio/sfx/{fire_cast,fire_impact,ice_cast,ice_impact,lightning_cast,lightning_impact,arcane_cast,arcane_impact,utility}.ogg` (silent 0.2-second placeholders)
- Create: `docs/audio/strudel/_template.strudel`
- Create: `docs/audio/strudel/stone.strudel`
- Create: `docs/audio/strudel/README.md`

- [ ] **Step 1: Generate silent placeholder ogg files**

```bash
mkdir -p public/audio/music public/audio/sfx docs/audio/strudel/sfx

# Music: 1.0s silence
for name in stone fire ice lightning arcane void boss; do
  ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 1.0 -c:a libvorbis -q:a 4 -y public/audio/music/$name.ogg
done

# SFX: 0.2s silence
for name in fire_cast fire_impact ice_cast ice_impact lightning_cast lightning_impact arcane_cast arcane_impact utility; do
  ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 0.2 -c:a libvorbis -q:a 4 -y public/audio/sfx/$name.ogg
done
```

Expected: 16 .ogg files exist; each is < 10kb (silence compresses well).

- [ ] **Step 2: Write the Strudel template**

Create `docs/audio/strudel/_template.strudel`:

```javascript
// Arcanum Strudel Template
// =========================
// Conventions for all biome and boss tracks:
//   - BPM:    biomes 70-90, boss 110-130
//   - Length: loops cleanly at 60-90 seconds
//   - Tempo:  setcps(BPM / 60 / 4)  // Strudel uses cycles per second; 1 cycle = 4 beats
//   - Output: stereo, 44.1kHz; record then convert to .ogg @ 96kbps via ffmpeg
//
// Biome palettes (suggested instruments):
//   stone:     reverby bells, low pulse, sparse                      "tabla", "gm_choir_aahs"
//   fire:      crackly textures, urgent hi-hats, warm bass           "gm_distortion_guitar", "tr909"
//   ice:       crystalline plucks, sustained pads, slow filter sweeps "gm_celesta", "gm_pad_warm"
//   lightning: stuttery hi-hats, glitchy squelches                   "gm_synth_drum", "wobblebass"
//   arcane:    detuned chords, warbly leads, off-grid percussion     "gm_pad_choir", "tabla"
//   void:      dissonant pads, deep sub-bass, sparse                 "gm_pad_halo", "sine"
//   boss:      higher BPM, all four elemental textures briefly, drum-driven
//
// Composition skeleton — replace with your patterns:

setcps(80 / 60 / 4)

stack(
  // drums / pulse
  s("bd ~ ~ ~").bank("RolandTR909").gain(0.7),

  // bass
  note("c2 ~ ~ g2").s("sawtooth").lpf(400).gain(0.5),

  // pad / lead
  note("c4 eb4 g4 bb4").s("gm_pad_warm").gain(0.4).room(0.6)
).slow(2)
```

- [ ] **Step 3: Write the example stone-biome composition**

Create `docs/audio/strudel/stone.strudel`:

```javascript
// Stone biome — "Ancient stone corridors, cold and silent."
// Sparse, reverby, low-mid tones. BPM 72.

setcps(72 / 60 / 4)

stack(
  // Distant church bell — sparse, every 4 cycles
  s("bell").gain(0.3).room(0.9).delay(0.4).struct("1 ~ ~ ~ ~ ~ ~ ~"),

  // Slow heartbeat pulse
  s("bd:2").gain(0.4).lpf(200).struct("1 ~ ~ ~ 1 ~ ~ ~"),

  // Distant choir pad
  note("<c2 g1 ab1 eb2>").s("gm_choir_aahs").gain(0.25).room(0.85).attack(0.5).release(2),

  // Sparse high tone — feels like wind
  note("<c5 ~ ~ eb5>").s("gm_celesta").gain(0.15).room(0.8).delay(0.6).slow(2)
)
```

- [ ] **Step 4: Write the README workflow**

Create `docs/audio/strudel/README.md`:

```markdown
# Arcanum Music & SFX — Strudel Composition

All music and SFX in this project are composed in [strudel.cc](https://strudel.cc), a browser-based live coding environment.

## Workflow

1. Open <https://strudel.cc>.
2. Paste the contents of `_template.strudel` (or an existing track like `stone.strudel`) into the editor.
3. Iterate until you like the loop.
4. Click "Record" in Strudel's UI and let it play for one full loop length (60-90 seconds for music, 0.2-0.6 seconds for SFX).
5. Click "Stop" to end recording. Strudel saves a `.wav` file.
6. Convert to `.ogg` (smaller, web-friendly):

   For music (stereo, 96kbps, normalized):
   ```bash
   ffmpeg -i input.wav -c:a libvorbis -q:a 3 -af "loudnorm=I=-16:LRA=7:TP=-2" public/audio/music/<name>.ogg
   ```

   For SFX (stereo, 128kbps, no loudnorm — preserves transient):
   ```bash
   ffmpeg -i input.wav -c:a libvorbis -q:a 4 public/audio/sfx/<name>.ogg
   ```

7. Trim seamless loops if needed:
   ```bash
   ffmpeg -ss 0 -to 60 -i input.ogg -c copy looped.ogg
   ```

8. Save the Strudel source to `docs/audio/strudel/<name>.strudel` and commit alongside the `.ogg`.

## File checklist

Music (7 tracks): stone, fire, ice, lightning, arcane, void, boss
SFX (9 sounds): {fire,ice,lightning,arcane}_{cast,impact}, utility

See `_template.strudel` for biome palettes and BPM conventions.
```

- [ ] **Step 5: Commit**

```bash
git add public/audio docs/audio
git commit -m "feat: audio asset placeholders + Strudel composition workflow"
```

---

## Task 3: AudioStore — localStorage-backed volume persistence

**Files:**
- Create: `src/audio/AudioStore.ts`
- Test: `tests/AudioStore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/AudioStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { AudioStore } from '../src/audio/AudioStore'

describe('AudioStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when localStorage is empty', () => {
    const store = new AudioStore()
    expect(store.master).toBe(0.8)
    expect(store.music).toBe(0.8)
    expect(store.sfx).toBe(0.9)
    expect(store.muted).toBe(false)
  })

  it('persists changes and reloads them on next construction', () => {
    const a = new AudioStore()
    a.master = 0.5
    a.music = 0.4
    a.sfx = 0.7
    a.muted = true

    const b = new AudioStore()
    expect(b.master).toBe(0.5)
    expect(b.music).toBe(0.4)
    expect(b.sfx).toBe(0.7)
    expect(b.muted).toBe(true)
  })

  it('clamps values to [0, 1]', () => {
    const s = new AudioStore()
    s.master = -0.5
    expect(s.master).toBe(0)
    s.music = 2.0
    expect(s.music).toBe(1)
  })

  it('survives corrupt JSON in localStorage', () => {
    localStorage.setItem('arcanum.audio', '{not valid json')
    const s = new AudioStore()
    expect(s.master).toBe(0.8)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/AudioStore.test.ts`
Expected: FAIL — module `'../src/audio/AudioStore'` not found.

- [ ] **Step 3: Implement AudioStore**

Create `src/audio/AudioStore.ts`:

```ts
const KEY = 'arcanum.audio'

interface Persisted {
  master: number
  music:  number
  sfx:    number
  muted:  boolean
}

const DEFAULTS: Persisted = { master: 0.8, music: 0.8, sfx: 0.9, muted: false }

const clamp = (v: number) => Math.max(0, Math.min(1, v))

export class AudioStore {
  private state: Persisted

  constructor() {
    this.state = this.load()
  }

  get master(): number { return this.state.master }
  set master(v: number) { this.state.master = clamp(v); this.save() }

  get music(): number { return this.state.music }
  set music(v: number) { this.state.music = clamp(v); this.save() }

  get sfx(): number { return this.state.sfx }
  set sfx(v: number) { this.state.sfx = clamp(v); this.save() }

  get muted(): boolean { return this.state.muted }
  set muted(v: boolean) { this.state.muted = v; this.save() }

  private load(): Persisted {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return { ...DEFAULTS }
      const parsed = JSON.parse(raw) as Partial<Persisted>
      return {
        master: typeof parsed.master === 'number' ? clamp(parsed.master) : DEFAULTS.master,
        music:  typeof parsed.music  === 'number' ? clamp(parsed.music)  : DEFAULTS.music,
        sfx:    typeof parsed.sfx    === 'number' ? clamp(parsed.sfx)    : DEFAULTS.sfx,
        muted:  typeof parsed.muted  === 'boolean' ? parsed.muted        : DEFAULTS.muted,
      }
    } catch {
      return { ...DEFAULTS }
    }
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state))
    } catch {
      // storage full / disabled — ignore, just don't persist
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/AudioStore.test.ts`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/audio/AudioStore.ts tests/AudioStore.test.ts
git commit -m "feat: AudioStore persists volume settings to localStorage"
```

---

## Task 4: Audio manifest — track + SFX file table

**Files:**
- Create: `src/audio/manifest.ts`

- [ ] **Step 1: Implement the manifest**

Create `src/audio/manifest.ts`:

```ts
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
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean — references existing `BiomeType` and `SpellElement` types.

- [ ] **Step 3: Commit**

```bash
git add src/audio/manifest.ts
git commit -m "feat: audio file manifest for music and SFX"
```

---

## Task 5: AudioBackend interface + FakeAudioBackend for tests

**Files:**
- Create: `src/audio/AudioBackend.ts`
- Create: `tests/FakeAudioBackend.ts`

- [ ] **Step 1: Define the interface**

Create `src/audio/AudioBackend.ts`:

```ts
/**
 * Minimal audio backend abstraction.
 * Production: HowlerAudioBackend (added in Task 8).
 * Tests:      FakeAudioBackend (in tests/FakeAudioBackend.ts).
 */

export type InstanceId = number

export interface PlayOpts {
  loop?:   boolean
  volume?: number  // 0..1
}

export interface AudioBackend {
  /** Preload an audio file under a stable id. Idempotent. */
  load(id: string, src: string): Promise<void>

  /** Begin playback. Returns an instance id for later stop/setVolume. */
  play(id: string, opts?: PlayOpts): InstanceId

  /** Stop a specific playing instance. No-op if already stopped. */
  stop(instance: InstanceId): void

  /** Set volume on a playing instance. */
  setVolume(instance: InstanceId, volume: number): void

  /** Resume the audio context (browser autoplay policy). */
  unlock(): Promise<void>
}
```

- [ ] **Step 2: Implement FakeAudioBackend**

Create `tests/FakeAudioBackend.ts`:

```ts
import type { AudioBackend, InstanceId, PlayOpts } from '../src/audio/AudioBackend'

interface FakeInstance {
  id:        InstanceId
  fileId:    string
  volume:    number
  loop:      boolean
  playing:   boolean
}

export class FakeAudioBackend implements AudioBackend {
  loaded:    Set<string>           = new Set()
  instances: Map<InstanceId, FakeInstance> = new Map()
  unlocked   = false
  private nextId: InstanceId = 1

  async load(id: string, _src: string): Promise<void> {
    this.loaded.add(id)
  }

  play(id: string, opts: PlayOpts = {}): InstanceId {
    const instance: FakeInstance = {
      id:      this.nextId++,
      fileId:  id,
      volume:  opts.volume ?? 1,
      loop:    opts.loop ?? false,
      playing: true,
    }
    this.instances.set(instance.id, instance)
    return instance.id
  }

  stop(instance: InstanceId): void {
    const i = this.instances.get(instance)
    if (i) i.playing = false
  }

  setVolume(instance: InstanceId, volume: number): void {
    const i = this.instances.get(instance)
    if (i) i.volume = volume
  }

  async unlock(): Promise<void> {
    this.unlocked = true
  }

  // Test helpers ──────────────────────────────────────────────────────

  /** Return all currently-playing instances. */
  active(): FakeInstance[] {
    return [...this.instances.values()].filter(i => i.playing)
  }

  /** Find the active instance for a given file id, or null. */
  activeFor(fileId: string): FakeInstance | null {
    return this.active().find(i => i.fileId === fileId) ?? null
  }
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/audio/AudioBackend.ts tests/FakeAudioBackend.ts
git commit -m "feat: AudioBackend interface + FakeAudioBackend for tests"
```

---

## Task 6: MusicManager — state, crossfade, silence, volume

**Files:**
- Create: `src/audio/MusicManager.ts`
- Test: `tests/MusicManager.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/MusicManager.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicManager } from '../src/audio/MusicManager'
import { AudioStore } from '../src/audio/AudioStore'
import { FakeAudioBackend } from './FakeAudioBackend'
import { MUSIC_FILES } from '../src/audio/manifest'

describe('MusicManager', () => {
  let backend: FakeAudioBackend
  let store:   AudioStore
  let mm:      MusicManager

  beforeEach(() => {
    localStorage.clear()
    backend = new FakeAudioBackend()
    store   = new AudioStore()
    mm      = new MusicManager(backend, store)
  })

  it('preloads no tracks until preload() is called', () => {
    expect(backend.loaded.size).toBe(0)
  })

  it('preload() loads the requested tracks', async () => {
    await mm.preload(['stone', 'boss'])
    expect(backend.loaded.has('music:stone')).toBe(true)
    expect(backend.loaded.has('music:boss')).toBe(true)
  })

  it('play(track) starts that track at full volume', async () => {
    await mm.preload(['stone'])
    mm.play('stone')
    const i = backend.activeFor('music:stone')
    expect(i).not.toBeNull()
    expect(i!.loop).toBe(true)
  })

  it('crossfadeTo() ramps current down and new up over the duration', async () => {
    await mm.preload(['stone', 'fire'])
    mm.play('stone')
    mm.crossfadeTo('fire', 1.0)
    // halfway through
    mm.update(0.5)
    const stone = backend.activeFor('music:stone')!
    const fire  = backend.activeFor('music:fire')!
    expect(stone.volume).toBeGreaterThan(0.3)
    expect(stone.volume).toBeLessThan(0.55)
    expect(fire.volume).toBeGreaterThan(0.3)
    expect(fire.volume).toBeLessThan(0.55)
    // complete
    mm.update(0.6)
    expect(backend.activeFor('music:stone')).toBeNull()
    expect(backend.activeFor('music:fire')).not.toBeNull()
  })

  it('stopWithSilence() fades current track and leaves nothing playing', async () => {
    await mm.preload(['stone'])
    mm.play('stone')
    mm.stopWithSilence(0.5)
    mm.update(0.5)
    expect(backend.activeFor('music:stone')).toBeNull()
  })

  it('queues play() calls until unlock() resolves', async () => {
    await mm.preload(['stone'])
    mm.play('stone')  // before unlock
    expect(backend.activeFor('music:stone')).toBeNull()
    await mm.unlock()
    expect(backend.activeFor('music:stone')).not.toBeNull()
  })

  it('master * music volume is applied on play', async () => {
    store.master = 0.5
    store.music  = 0.5
    await mm.preload(['stone'])
    await mm.unlock()
    mm.play('stone')
    expect(backend.activeFor('music:stone')!.volume).toBeCloseTo(0.25, 5)
  })

  it('mute silences live tracks; unmute restores them', async () => {
    await mm.preload(['stone'])
    await mm.unlock()
    mm.play('stone')
    const before = backend.activeFor('music:stone')!.volume
    store.muted = true
    mm.applyVolume()
    expect(backend.activeFor('music:stone')!.volume).toBe(0)
    store.muted = false
    mm.applyVolume()
    expect(backend.activeFor('music:stone')!.volume).toBeCloseTo(before, 5)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/MusicManager.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement MusicManager**

Create `src/audio/MusicManager.ts`:

```ts
import type { AudioBackend, InstanceId } from './AudioBackend'
import type { AudioStore } from './AudioStore'
import { MUSIC_FILES, type TrackId } from './manifest'

interface ActiveTrack {
  track:      TrackId
  instance:   InstanceId
  baseVolume: number  // before master/music multiplication
}

interface Fade {
  outgoing?: { active: ActiveTrack; targetVolume: number }
  incoming?: { active: ActiveTrack; targetVolume: number }
  elapsed:   number
  duration:  number
}

const fileId = (track: TrackId) => `music:${track}`

export class MusicManager {
  private current: ActiveTrack | null = null
  private fade:    Fade | null        = null
  private unlocked = false
  private pending: TrackId | null     = null

  constructor(
    private readonly backend: AudioBackend,
    private readonly store:   AudioStore,
  ) {}

  // ── Loading ─────────────────────────────────────────────────────────

  async preload(tracks: TrackId[]): Promise<void> {
    await Promise.all(tracks.map(t => this.backend.load(fileId(t), MUSIC_FILES[t])))
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  async unlock(): Promise<void> {
    if (this.unlocked) return
    await this.backend.unlock()
    this.unlocked = true
    if (this.pending) {
      const next = this.pending
      this.pending = null
      this.play(next)
    }
  }

  // ── Playback ────────────────────────────────────────────────────────

  /** Hard-cut to a track. */
  play(track: TrackId): void {
    if (!this.unlocked) {
      this.pending = track
      return
    }
    this.stopAllImmediately()
    const baseVolume = 1
    const instance = this.backend.play(fileId(track), { loop: true, volume: this.effectiveVolume(baseVolume) })
    this.current = { track, instance, baseVolume }
  }

  /** Fade current down while fading new up. */
  crossfadeTo(track: TrackId, duration: number): void {
    if (!this.unlocked) {
      this.pending = track
      return
    }
    if (this.current?.track === track) return  // already playing this track

    const incomingInstance = this.backend.play(fileId(track), { loop: true, volume: 0 })
    const incoming: ActiveTrack = { track, instance: incomingInstance, baseVolume: 0 }

    this.fade = {
      outgoing: this.current ? { active: this.current, targetVolume: 0 } : undefined,
      incoming: { active: incoming, targetVolume: 1 },
      elapsed:  0,
      duration,
    }
    this.current = incoming
  }

  /** Fade current down, leave silence. */
  stopWithSilence(duration: number): void {
    if (!this.current) return
    this.fade = {
      outgoing: { active: this.current, targetVolume: 0 },
      elapsed:  0,
      duration,
    }
    this.current = null
  }

  // ── Per-frame tick ──────────────────────────────────────────────────

  update(delta: number): void {
    if (!this.fade) return
    this.fade.elapsed += delta
    const t = Math.min(1, this.fade.elapsed / this.fade.duration)

    if (this.fade.outgoing) {
      const start = this.fade.outgoing.active.baseVolume
      const next  = start + (this.fade.outgoing.targetVolume - start) * t
      this.fade.outgoing.active.baseVolume = next
      this.backend.setVolume(this.fade.outgoing.active.instance, this.effectiveVolume(next))
    }
    if (this.fade.incoming) {
      const next = this.fade.incoming.targetVolume * t
      this.fade.incoming.active.baseVolume = next
      this.backend.setVolume(this.fade.incoming.active.instance, this.effectiveVolume(next))
    }

    if (t >= 1) {
      if (this.fade.outgoing && this.fade.outgoing.targetVolume === 0) {
        this.backend.stop(this.fade.outgoing.active.instance)
      }
      this.fade = null
    }
  }

  // ── Volume ──────────────────────────────────────────────────────────

  /** Re-apply current volume after store changes. Public so AudioPanel can call it on slider input. */
  applyVolume(): void {
    if (this.fade?.outgoing) {
      this.backend.setVolume(this.fade.outgoing.active.instance, this.effectiveVolume(this.fade.outgoing.active.baseVolume))
    }
    if (this.current) {
      this.backend.setVolume(this.current.instance, this.effectiveVolume(this.current.baseVolume))
    }
  }

  // ── Internals ───────────────────────────────────────────────────────

  private effectiveVolume(base: number): number {
    if (this.store.muted) return 0
    return base * this.store.master * this.store.music
  }

  private stopAllImmediately(): void {
    if (this.current) {
      this.backend.stop(this.current.instance)
      this.current = null
    }
    if (this.fade?.outgoing) {
      this.backend.stop(this.fade.outgoing.active.instance)
    }
    if (this.fade?.incoming && this.fade.incoming.active !== this.current) {
      this.backend.stop(this.fade.incoming.active.instance)
    }
    this.fade = null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/MusicManager.test.ts`
Expected: PASS — 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/audio/MusicManager.ts tests/MusicManager.test.ts
git commit -m "feat: MusicManager with crossfade, silence, autoplay-aware queue"
```

---

## Task 7: SfxManager — element-aware playback

**Files:**
- Create: `src/audio/SfxManager.ts`
- Test: `tests/SfxManager.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/SfxManager.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { SfxManager } from '../src/audio/SfxManager'
import { AudioStore } from '../src/audio/AudioStore'
import { FakeAudioBackend } from './FakeAudioBackend'

describe('SfxManager', () => {
  let backend: FakeAudioBackend
  let store:   AudioStore
  let sfx:     SfxManager

  beforeEach(() => {
    localStorage.clear()
    backend = new FakeAudioBackend()
    store   = new AudioStore()
    sfx     = new SfxManager(backend, store)
  })

  it('preloadAll() loads every (element, phase) combo + utility', async () => {
    await sfx.preloadAll()
    expect(backend.loaded.has('sfx:fire_cast')).toBe(true)
    expect(backend.loaded.has('sfx:fire_impact')).toBe(true)
    expect(backend.loaded.has('sfx:ice_cast')).toBe(true)
    expect(backend.loaded.has('sfx:arcane_impact')).toBe(true)
    expect(backend.loaded.has('sfx:utility')).toBe(true)
    expect(backend.loaded.size).toBe(9)
  })

  it('play(element, "cast") fires the right file', async () => {
    await sfx.preloadAll()
    sfx.play('fire', 'cast')
    expect(backend.activeFor('sfx:fire_cast')).not.toBeNull()
  })

  it('play(any, "utility") fires the shared utility file', async () => {
    await sfx.preloadAll()
    sfx.play('ice', 'utility')
    expect(backend.activeFor('sfx:utility')).not.toBeNull()
  })

  it('master * sfx volume is applied', async () => {
    store.master = 0.5
    store.sfx    = 0.4
    await sfx.preloadAll()
    sfx.play('lightning', 'impact')
    expect(backend.activeFor('sfx:lightning_impact')!.volume).toBeCloseTo(0.2, 5)
  })

  it('mute drives volume to zero', async () => {
    store.muted = true
    await sfx.preloadAll()
    sfx.play('arcane', 'cast')
    expect(backend.activeFor('sfx:arcane_cast')!.volume).toBe(0)
  })

  it('overlapping calls produce independent instances', async () => {
    await sfx.preloadAll()
    sfx.play('fire', 'cast')
    sfx.play('fire', 'cast')
    sfx.play('fire', 'cast')
    const all = backend.active().filter(i => i.fileId === 'sfx:fire_cast')
    expect(all.length).toBe(3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/SfxManager.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement SfxManager**

Create `src/audio/SfxManager.ts`:

```ts
import type { AudioBackend } from './AudioBackend'
import type { AudioStore } from './AudioStore'
import type { SpellElement } from '../spells/SpellDefinitions'
import { ALL_SFX_FILES, sfxFile, type SfxPhase } from './manifest'

const fileId = (publicPath: string) => 'sfx:' + publicPath.split('/').pop()!.replace('.ogg', '')

export class SfxManager {
  constructor(
    private readonly backend: AudioBackend,
    private readonly store:   AudioStore,
  ) {}

  async preloadAll(): Promise<void> {
    await Promise.all(ALL_SFX_FILES.map(src => this.backend.load(fileId(src), src)))
  }

  play(element: SpellElement, phase: SfxPhase): void {
    const src = sfxFile(element, phase)
    this.backend.play(fileId(src), { loop: false, volume: this.effectiveVolume() })
  }

  private effectiveVolume(): number {
    if (this.store.muted) return 0
    return this.store.master * this.store.sfx
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/SfxManager.test.ts`
Expected: PASS — 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/audio/SfxManager.ts tests/SfxManager.test.ts
git commit -m "feat: SfxManager with element-aware playback and overlap"
```

---

## Task 8: Howler-backed AudioBackend implementation

**Files:**
- Modify: `src/audio/AudioBackend.ts`

- [ ] **Step 1: Append HowlerAudioBackend**

Append to `src/audio/AudioBackend.ts`:

```ts
// ── Production Howler backend ───────────────────────────────────────

import { Howl, Howler } from 'howler'

interface LoadedSound {
  howl: Howl
}

export class HowlerAudioBackend implements AudioBackend {
  private sounds: Map<string, LoadedSound> = new Map()
  private instanceMap: Map<InstanceId, { sound: LoadedSound; howlId: number }> = new Map()
  private nextId: InstanceId = 1

  load(id: string, src: string): Promise<void> {
    if (this.sounds.has(id)) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const howl = new Howl({
        src:    [src],
        preload: true,
        onload:    () => { this.sounds.set(id, { howl }); resolve() },
        onloaderror: (_id, err) => reject(new Error(`Failed to load ${src}: ${err}`)),
      })
    })
  }

  play(id: string, opts: PlayOpts = {}): InstanceId {
    const sound = this.sounds.get(id)
    if (!sound) throw new Error(`AudioBackend.play: id "${id}" not loaded`)
    sound.howl.loop(opts.loop ?? false)
    const howlId = sound.howl.play()
    sound.howl.volume(opts.volume ?? 1, howlId)
    const instance = this.nextId++
    this.instanceMap.set(instance, { sound, howlId })
    sound.howl.once('end', () => {
      if (!sound.howl.loop(howlId)) this.instanceMap.delete(instance)
    }, howlId)
    return instance
  }

  stop(instance: InstanceId): void {
    const m = this.instanceMap.get(instance)
    if (!m) return
    m.sound.howl.stop(m.howlId)
    this.instanceMap.delete(instance)
  }

  setVolume(instance: InstanceId, volume: number): void {
    const m = this.instanceMap.get(instance)
    if (!m) return
    m.sound.howl.volume(volume, m.howlId)
  }

  async unlock(): Promise<void> {
    if (Howler.ctx?.state === 'suspended') {
      await Howler.ctx.resume()
    }
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean (Howler types resolved via `@types/howler`).

- [ ] **Step 3: Smoke-test in dev**

```bash
npx vite dev
```

Open the browser to the printed URL. The game should still launch normally — no audio behavior wired in yet, but the new module compiles and the Howler import resolves.

- [ ] **Step 4: Commit**

```bash
git add src/audio/AudioBackend.ts
git commit -m "feat: HowlerAudioBackend production implementation"
```

---

## Task 9: createAudio factory + index.ts

**Files:**
- Create: `src/audio/index.ts`

- [ ] **Step 1: Implement the factory**

Create `src/audio/index.ts`:

```ts
import { AudioStore } from './AudioStore'
import { MusicManager } from './MusicManager'
import { SfxManager } from './SfxManager'
import { HowlerAudioBackend, type AudioBackend } from './AudioBackend'

export interface Audio {
  store: AudioStore
  music: MusicManager
  sfx:   SfxManager
}

/** Create the audio system. Pass a custom backend in tests. */
export function createAudio(backend: AudioBackend = new HowlerAudioBackend()): Audio {
  const store = new AudioStore()
  const music = new MusicManager(backend, store)
  const sfx   = new SfxManager(backend, store)
  return { store, music, sfx }
}

export type { TrackId } from './manifest'
export { AudioStore }
export { MusicManager }
export { SfxManager }
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/audio/index.ts
git commit -m "feat: createAudio factory wires Howler backend by default"
```

---

## Task 10: Wire MusicManager into Game.ts (start, death, main loop tick)

**Files:**
- Modify: `src/core/Game.ts`

- [ ] **Step 1: Add audio field and instantiate**

In `src/core/Game.ts`, add the import near the top with other imports:

```ts
import { createAudio, type Audio } from '../audio'
import { ALL_SFX_FILES } from '../audio/manifest'
```

Add a private field on the `Game` class (place it near other singletons like `runData`, `difficulty`):

```ts
  readonly audio: Audio = createAudio()
```

(Marked `readonly` because the audio system lives the entire app lifetime.)

- [ ] **Step 2: Preload SFX + initial music in the existing init/start flow**

Locate the difficulty-selection click handler in `Game.ts` (the place where `running = true` is first set, around the section we modified during the wizard refactor — line ~140-180). At the START of that handler (before any heavy work), add:

```ts
    // Audio: preload SFX + boss + the initial biome on first run; unlock context on user gesture.
    await this.audio.sfx.preloadAll()
    await this.audio.music.preload(['boss'])
    await this.audio.music.unlock()
```

If the handler is not async, change its signature to `async`. Find the `init()` or equivalent starting routine — search for `this.running = true`. Add `await` around the audio setup.

If the surrounding code is synchronous (e.g. registered as a non-async event listener), wrap the audio init in an IIFE: `void (async () => { await this.audio.sfx.preloadAll(); await this.audio.music.preload(['boss']); await this.audio.music.unlock() })()`. The play() calls below queue safely until unlock() resolves.

- [ ] **Step 3: Tick MusicManager from the main loop**

Find the main `update(delta)` or animation-frame callback in `Game.ts` (search for `requestAnimationFrame` or for where `player.update(...)` is called). Add this line near the top of the update tick, BEFORE the player/enemy updates:

```ts
    this.audio.music.update(delta)
```

- [ ] **Step 4: Stop music on player death**

Find the player death handler (search for `startDying` calls or the equivalent — DungeonSession or Game.ts). After death is initiated, add:

```ts
    this.audio.music.stopWithSilence(0.3)
```

- [ ] **Step 5: Typecheck + dev smoke**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npx vite dev`, click into the game, confirm no console errors. Music won't play yet (DungeonSession doesn't drive it) but unlock + preload should fire silently.

- [ ] **Step 6: Commit**

```bash
git add src/core/Game.ts
git commit -m "feat: instantiate audio in Game; preload + unlock + tick"
```

---

## Task 11: Wire MusicManager into DungeonSession (biome change, boss, defeat)

**Files:**
- Modify: `src/dungeon/DungeonSession.ts`

- [ ] **Step 1: Pass audio into DungeonSession**

Find the `DungeonSession` constructor or `init()` method (where `Game.ts` instantiates / configures it). Add a `MusicManager` parameter:

In `DungeonSession`:

```ts
import type { MusicManager } from '../audio/MusicManager'
import type { TrackId } from '../audio/manifest'
import type { BiomeType } from './BiomeDefinitions'
```

Add a private field and constructor parameter (or `init()` parameter — match what `Game.ts` calls):

```ts
  private music: MusicManager | null = null

  setMusicManager(music: MusicManager): void {
    this.music = music
  }
```

In `Game.ts`, after `this.session = new DungeonSession(...)`, add:

```ts
    this.session.setMusicManager(this.audio.music)
```

Place this call once at construction, not on every run start.

- [ ] **Step 2: Trigger crossfade on biome description**

Locate `showBiomeDescription` at `src/dungeon/DungeonSession.ts:255`. At the top of the method, before any DOM work, add:

```ts
    if (this.music && room.type !== 'boss') {
      void this.music.preload([room.biome as TrackId])
      this.music.crossfadeTo(room.biome as TrackId, 1.5)
    }
```

The `room.type !== 'boss'` guard prevents biome music from briefly starting in a boss room (boss music handled separately below).

- [ ] **Step 3: Detect boss-room entry**

Find where `showBiomeDescription` is called from (`DungeonSession.ts:96` per earlier grep). The triggering code already knows `activeRoomData`. Right after the existing `showBiomeDescription` call, add:

```ts
            if (this.activeRoomData.type === 'boss' && this.music) {
              void this.music.preload(['boss'])
              this.music.stopWithSilence(0.5)
              setTimeout(() => this.music?.play('boss'), 900)  // 500ms fade + 400ms gap
            }
```

- [ ] **Step 4: Detect boss defeat**

Look at `onEnemyDied` (`DungeonSession.ts:183`). It currently fires unconditionally. Modify to detect boss death: at the top of the handler, check if there's still a living boss:

Replace the existing `this.onEnemyDied?.()` call with:

```ts
    const wasBossFight = this.enemies.some(e => e.isBoss)
    const stillBossAlive = this.enemies.some(e => e.alive && e.isBoss)
    this.onEnemyDied?.()
    if (wasBossFight && !stillBossAlive && this.music && this.activeRoomData) {
      this.music.crossfadeTo(this.activeRoomData.biome as TrackId, 1.5)
    }
```

Place this in whichever method contains line 183.

- [ ] **Step 5: Typecheck + dev smoke**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npx vite dev`. Start a run, walk between rooms — placeholder silent tracks will swap (you can verify via Network tab or by temporarily replacing one placeholder with a non-silent file).

- [ ] **Step 6: Commit**

```bash
git add src/core/Game.ts src/dungeon/DungeonSession.ts
git commit -m "feat: drive music from dungeon session (biome, boss, defeat)"
```

---

## Task 12: Wire SfxManager into SpellCaster + Projectile

**Files:**
- Modify: `src/spells/SpellCaster.ts`
- Modify: `src/entities/Projectile.ts`

- [ ] **Step 1: Add SfxManager parameter to SpellCaster**

In `src/spells/SpellCaster.ts`, near the existing imports:

```ts
import type { SfxManager } from '../audio/SfxManager'
```

Add a constructor parameter or setter — match the existing dependency injection style. If `SpellCaster` uses a constructor with injected dependencies, add `private sfx: SfxManager` to the constructor signature. If it uses setter injection like `manaSrc`, add:

```ts
  setSfx(sfx: SfxManager): void { this.sfx = sfx }

  private sfx: SfxManager | null = null
```

In `Game.ts`, after `this.spellCaster = new SpellCaster(...)`, add:

```ts
    this.spellCaster.setSfx(this.audio.sfx)
```

- [ ] **Step 2: Fire cast SFX**

Inside `SpellCaster.cast()` at `src/spells/SpellCaster.ts:45`, immediately after the mana/cooldown checks pass and `this.manaSrc.mana -= cost` (around line 61), add:

```ts
    if (this.sfx) {
      const phase = spell.type === 'self' ? 'utility' : 'cast'
      this.sfx.play(spell.element, phase)
      // AOE: layer impact 50ms after cast for body
      if (spell.type === 'aoe') {
        setTimeout(() => this.sfx?.play(spell.element, 'impact'), 50)
      }
    }
```

- [ ] **Step 3: Add SfxManager parameter to Projectile**

In `src/entities/Projectile.ts`:

```ts
import type { SfxManager } from '../audio/SfxManager'
```

Modify the constructor to accept an optional `SfxManager`. The existing constructor signature is `constructor(origin, dir, spell, scene)`. Append `sfx?: SfxManager`:

```ts
  constructor(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    spell: Spell,
    scene: THREE.Scene,
    private readonly sfx?: SfxManager,
  ) {
    // ... existing body
  }
```

- [ ] **Step 4: Pass sfx through where Projectiles are constructed**

Search for `new Projectile(` across the codebase:

```bash
grep -rn "new Projectile(" src/
```

You'll find callsites in `SpellCaster.ts` (player projectiles) and `Enemy.ts` (enemy projectiles). For each, append `, this.sfx` (SpellCaster) or pass through from a setter on Enemy. For Enemy enemy projectiles, the simplest path is making the SfxManager available — Enemy has access to `scene` from update calls, and we can route SFX via the same Game instance. To minimize coupling, accept that **only player-cast projectiles trigger impact SFX**; enemy-fired projectiles construct without sfx (the `?:` makes it optional).

In `SpellCaster.ts` projectile-creation site (around line 67-69):

```ts
      const proj = new Projectile(origin, dir, effectiveSpell, scene, this.sfx ?? undefined)
```

Leave `Enemy.ts` projectile creation unchanged — enemy projectiles play no impact SFX in this version.

- [ ] **Step 5: Fire impact SFX in Projectile.destroy**

In `src/entities/Projectile.ts`, locate the `destroy(scene)` method at line 137. At the top of the method (before scene removal), add:

```ts
    this.sfx?.play(this.spell.element, 'impact')
```

(Adjust the field name if `spell` is named differently — read the constructor body to confirm.)

- [ ] **Step 6: Typecheck + dev smoke**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npx vite dev`, cast a spell, confirm no console errors. With placeholder silent SFX you won't hear anything yet, but the call sites should fire (verify by adding a temporary `console.log` inside `SfxManager.play`, then remove before commit).

- [ ] **Step 7: Commit**

```bash
git add src/spells/SpellCaster.ts src/entities/Projectile.ts src/core/Game.ts
git commit -m "feat: spell cast and projectile impact SFX"
```

---

## Task 13: AudioPanel UI inside Spellbook

**Files:**
- Create: `src/ui/AudioPanel.ts`
- Modify: `src/ui/Spellbook.ts`

- [ ] **Step 1: Implement AudioPanel**

Create `src/ui/AudioPanel.ts`:

```ts
import type { Audio } from '../audio'

export class AudioPanel {
  readonly element: HTMLDivElement

  constructor(private readonly audio: Audio) {
    this.element = document.createElement('div')
    this.element.className = 'audio-panel'
    this.element.innerHTML = `
      <h3>Audio</h3>
      <label>Master <input type="range" min="0" max="1" step="0.05" data-audio="master"></label>
      <label>Music  <input type="range" min="0" max="1" step="0.05" data-audio="music"></label>
      <label>SFX    <input type="range" min="0" max="1" step="0.05" data-audio="sfx"></label>
      <label><input type="checkbox" data-audio="muted"> Mute</label>
    `

    const setSlider = (key: 'master' | 'music' | 'sfx') => {
      const el = this.element.querySelector<HTMLInputElement>(`input[data-audio="${key}"]`)!
      el.value = String(audio.store[key])
      el.addEventListener('input', () => {
        audio.store[key] = Number(el.value)
        audio.music.applyVolume()
      })
    }
    setSlider('master')
    setSlider('music')
    setSlider('sfx')

    const muteEl = this.element.querySelector<HTMLInputElement>('input[data-audio="muted"]')!
    muteEl.checked = audio.store.muted
    muteEl.addEventListener('change', () => {
      audio.store.muted = muteEl.checked
      audio.music.applyVolume()
    })
  }
}
```

- [ ] **Step 2: Mount AudioPanel inside Spellbook**

In `src/ui/Spellbook.ts`, find the `show()` method at line 43 and the constructor. Add an import:

```ts
import { AudioPanel } from './AudioPanel'
import type { Audio } from '../audio'
```

Constructor: accept an `Audio` instance. Look at the existing constructor signature, append:

```ts
  constructor(/* existing params */, private readonly audio: Audio) {
```

In `Game.ts`, find where `Spellbook` is instantiated and pass `this.audio`:

```ts
    this.spellbook = new Spellbook(/* existing args */, this.audio)
```

Inside `Spellbook.show()`, after the existing DOM-rendering, append the audio panel:

```ts
    const panel = new AudioPanel(this.audio).element
    this.element.appendChild(panel)
```

(`this.element` is whatever the Spellbook's root container is — confirm name when reading the file.)

- [ ] **Step 3: Add basic styles**

Open `styles.css` (it's at the repo root). Add at the bottom:

```css
.audio-panel {
  margin-top: 16px;
  padding: 12px;
  border-top: 1px solid #444;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}
.audio-panel h3 { margin: 0 0 4px; font-size: 14px; }
.audio-panel label { display: flex; align-items: center; gap: 8px; }
.audio-panel input[type="range"] { flex: 1; }
```

- [ ] **Step 4: Typecheck + dev smoke**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npx vite dev`, open the Spellbook, confirm sliders render and dragging master volume below 0.2 makes any current music quieter (test by replacing one placeholder ogg with a non-silent file). Confirm settings persist after page reload.

- [ ] **Step 5: Commit**

```bash
git add src/ui/AudioPanel.ts src/ui/Spellbook.ts styles.css src/core/Game.ts
git commit -m "feat: audio panel in spellbook (master/music/sfx/mute)"
```

---

## Task 14: Final integration smoke test

**Files:** none modified — manual validation only.

- [ ] **Step 1: Replace one placeholder with a real composition**

Use the workflow in `docs/audio/strudel/README.md` to record `stone.strudel`, convert to `.ogg`, and place at `public/audio/music/stone.ogg`. (At minimum, replace this one — the rest can be composed iteratively post-merge.)

- [ ] **Step 2: Manual end-to-end checks**

```bash
npx vite dev
```

Open browser, then verify each of these in turn:

1. **Autoplay gate:** No audio should play before clicking "start difficulty".
2. **Initial track:** After clicking start, stone.ogg should begin playing (looping) within ~0.5s.
3. **Biome change:** Walk into a fire-biome room. Stone fades out and fire fades in over ~1.5s. (Fire is still the silent placeholder, so this manifests as silence — confirm via Network tab or browser audio inspector.)
4. **Boss room:** Walk into the boss room. Current track fades out fast, ~0.4s of silence, then `boss.ogg` kicks. (Silent placeholder — verify via Network.)
5. **Boss defeat:** Kill the boss. Boss track fades out, biome track fades in.
6. **Player death:** Take fatal damage. Music fades to silence over ~0.3s.
7. **SFX:** Cast a spell. Network tab shows the matching SFX file requested. (Silent placeholder — replace one to confirm audibly.)
8. **Volume sliders:** Open Spellbook → Audio. Drag music slider to 0 — current music silences immediately. Drag back up — restored.
9. **Mute:** Toggle mute checkbox. All audio silences. Untoggle — restores.
10. **Persistence:** Reload page. Slider values and mute state preserved.

- [ ] **Step 3: Run full test suite**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: typecheck clean. Vitest: prior passing tests still pass plus 3 new test files (AudioStore, MusicManager, SfxManager). The pre-existing `SpellDefinitions` failure (24 vs 16 spells) is the baseline; nothing new should fail.

- [ ] **Step 4: Commit any audio asset replacements made during smoke testing**

```bash
git add public/audio docs/audio
git commit -m "feat: stone biome composition (first real Strudel track)"
```

(Only commit this step if you actually composed and replaced the stone track during the smoke test.)

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - "7 looping music tracks" → Tasks 2 (placeholders) + 14 (composition workflow validates iteration)
  - "9 spell SFX (4×2 + utility)" → Tasks 2, 4 (manifest), 7 (manager), 12 (wiring)
  - "MusicManager + SfxManager backed by Howler" → Tasks 5, 6, 7, 8, 9
  - "Volume controls persisted to localStorage" → Tasks 3, 13
  - "Audio panel in existing options/spellbook screen" → Task 13
  - "Strudel patterns checked into repo" → Task 2
  - "Biome change crossfade" → Task 11 step 2
  - "Boss room: 500ms fade + 400ms silence + boss kick" → Task 11 step 3
  - "Boss defeat → biome crossfade" → Task 11 step 4
  - "Player death → silence" → Task 10 step 4
  - "Difficulty button drives unlock" → Task 10 step 2
  - "Preload SFX up front, music lazy per biome" → Task 10 step 2 (preload boss + sfx) + Task 11 step 2 (preload biome on enter)
  - "Element × phase SFX with AOE = cast + impact" → Task 12 step 2
  - "Beam: cast only" → handled implicitly: Task 12 only fires impact in Projectile.destroy; beam spells don't construct Projectiles in the same way (verify during implementation; fall back to spell.type filter if needed)

- [x] **Placeholder scan:** No "TBD" / "implement later" / "handle edge cases" instances. Every code step contains real code.

- [x] **Type consistency:** `TrackId`, `SfxPhase`, `AudioBackend`, `InstanceId`, `Audio`, `SpellElement`, `BiomeType` — all referenced consistently. `MusicManager.preload`, `play`, `crossfadeTo`, `stopWithSilence`, `update`, `unlock`, `applyVolume` are the same names in implementation, tests, and wiring tasks. `SfxManager.preloadAll`, `play`, `effectiveVolume` likewise. `AudioStore.master/music/sfx/muted` match across task 3, task 6, task 7, task 13.

- [x] **One ambiguity flagged for implementer:** Task 11 step 1 says "match the existing dependency injection style" for SfxManager wiring — implementer must read the surrounding code to choose constructor vs setter injection. Both options are spelled out.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-26-strudel-audio-system.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach?
