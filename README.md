# Arcanum

> **A minimalist composite-geometry wizard roguelike — four elements, six biomes, three Archmagi.**

Aim with your mouse, fling fire-ice-lightning-arcane through procedurally-shifting biomes, and topple the three Archmagi who rule each one. Built for [Vibe Jam 2026](https://vibej.am/2026).

---

## Play

| Action            | Key                                                              |
|-------------------|------------------------------------------------------------------|
| Move              | `W` `A` `S` `D`                                                  |
| Aim               | Mouse                                                            |
| Cast spell slots  | `Q` `E` `R` `F`                                                  |
| Heal (flask)      | `Shift`                                                          |
| Dodge roll        | `Space`                                                          |
| Switch spell bar  | `Tab`                                                            |
| Open spellbook    | (loadout shown between runs)                                     |

Each room is a procedurally generated arena. Six biomes — **stone**, **fire**, **ice**, **lightning**, **arcane**, **void** — each with its own enemy element bias, ambient hazards, and boss variant at depth. Spells gain mastery stars as you cast them, unlocking refined versions you can equip in your loadout. Die, repeat, get further.

---

## Quick start

```bash
npm install
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # Production bundle into dist/
npm test             # Vitest suite (159 tests across 17 files)
```

Requires Node 20+.

---

## Project structure

```
src/
  audio/         MusicManager / SfxManager / AudioStore — Howler-backed
  core/          Game.ts (entry), SceneManager, InputManager
  dungeon/       Procedural rooms, biomes, dungeon session lifecycle
  entities/      Player, Enemy, Projectile, SpellBookOrb (composite wizards)
  fx/            TrailSystem (movement trails)
  portal/        Vibe Jam 2026 webring portals
  progression/   PlayerInventory, MasterySystem, Grimoire, RunData, DifficultySystem
  spells/        SpellDefinitions (24 spells), SpellCaster, SpellEffects, SpellBar
  ui/            TitleScreen, LoadoutScreen, Spellbook, HUD, EvolutionOverlay
  visuals/       WizardModel factory (composite geometry: hat + robe + staff + orb)

public/
  audio/         Music + SFX .ogg files served at /audio/...
  assets/        Spell-icon assets

docs/
  audio/strudel/ Strudel composition sources for every track + workflow
  superpowers/   Specs and implementation plans (kept for posterity)
```

A run flows: **TitleScreen** → **LoadoutScreen** (Spellbook + difficulty) → **Game.startRun()** → procedurally generated rooms → death or victory → **RunSummaryScreen** → loadout again.

---

## Audio

Every music track and SFX in this game is composed in [strudel.cc](https://strudel.cc) — a browser-based JavaScript live-coding environment for music. Sources live in [`docs/audio/strudel/`](docs/audio/strudel/) and recordings are exported to `.ogg` and served from `public/audio/`.

- **7 music tracks** — one per biome plus a dedicated boss track. Crossfades between rooms; the boss-room transition does a 500ms fade-out, 400ms of silence, then a hard kick.
- **9 SFX patterns** — element × {cast, impact} for the four elements, plus a shared utility sound for self-buffs (blink, ice barrier).

Workflow: see [`docs/audio/strudel/README.md`](docs/audio/strudel/README.md) for how to record from strudel.cc, convert with `ffmpeg`, and drop in.

---

## Visuals

Wizards (player, enemies, bosses) are not sprites — they're composite Three.js primitives assembled by a single factory: a tapered cylinder robe, a sphere head, a cone hat, a thin cylinder staff, and an emissive orb at the staff tip. Per-archetype configs in [`src/visuals/EnemyModelConfig.ts`](src/visuals/EnemyModelConfig.ts) tune dimensions, colors, and emissive intensity for apprentices, battle mages, warlocks, and the three boss variants (Archlich / Inferno Titan / Storm Weaver).

The cursor on the game canvas is a tiny SVG wand at `public/cursor-wand.svg`.

---

## Vibe Jam 2026

Arcanum is part of the [Vibe Jam 2026](https://vibej.am/2026) webring:

- **Widget tracker** — `<script async src="https://vibej.am/2026/widget.js">` in the page head.
- **Exit portal** — green torus in the start room, plus a small pulsing portal icon under the minimap. Either one drops you onto a random other Vibe Jam game with player metadata forwarded.
- **Start portal** — when arriving from another jam game (`?portal=true&ref=...`), a red portal spawns at your spawn point so you can hop back. Title screen is skipped on portal arrival for instant continuity.

Portal logic lives in [`src/portal/VibeJamPortals.ts`](src/portal/VibeJamPortals.ts).

---

## Tech stack

- **TypeScript** + **Vite** + **Vitest** (jsdom)
- **Three.js** for rendering
- **Howler.js** for audio (preload + crossfade + autoplay-policy unlock)
- **Strudel** for composing the soundtrack (offline; not a runtime dep)

Bundle size: ~228 KB gzipped JS, ~7 KB gzipped CSS, ~17 MB of `.ogg` audio. Eager-preloads all music in the background while the title screen is showing, so the first room is never silent.

---

## Development notes

- `vite.config.ts` excludes `.worktrees/**` from the test runner so parallel feature branches don't cross-pollute. Ignore the `.superpowers/` directory — it's a cache for the brainstorming skill's visual companion.
- Volume settings persist to `localStorage` under `arcanum.audio` (master / music / sfx / muted). The audio panel UI is currently hidden but the manager API supports rebinding it to a settings menu if you want it back.
- Pre-existing `tests/SpellDefinitions.test.ts` was updated when the spell roster grew from 16 to 24 — the count assertion now matches reality.
