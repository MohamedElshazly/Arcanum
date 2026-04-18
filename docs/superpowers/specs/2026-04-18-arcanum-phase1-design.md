# Arcanum — Phase 1 Design Spec

**Date:** 2026-04-18  
**Scope:** Phase 1 only — playable proof of concept, single room, one enemy, one spell  
**Stack:** Vite + TypeScript (strict), Three.js via npm, vanilla JS, no framework  

---

## Overview

Arcanum is a browser-based top-down action RPG (wizard dungeon crawler) built for VibeJam. The player is a wizard who prepares a loadout of spells before entering a procedurally generated dungeon. Phase 1 establishes the core game loop: movement, one enemy, one spell, collision, and a basic HUD.

---

## Game Name

**Arcanum** (matches repo name).

---

## Tech Stack

- **Vite** — local dev server, no custom config beyond defaults
- **TypeScript** — `strict: true`, `moduleResolution: bundler`
- **Three.js** — installed via npm (not CDN) for types and tree-shaking
- **No frameworks** — no React, Vue, or game engine
- **Single HTML entry** — `index.html` → `src/main.ts`

---

## File Structure (Phase 1)

Only the following files are created in Phase 1. All other paths from the full spec are deferred.

```
/src
  /core
    Game.ts           — main loop, clock, orchestration only
    InputManager.ts   — keyboard state (pressed/held/released)
    SceneManager.ts   — WebGLRenderer, scene, OrthographicCamera
  /entities
    Player.ts         — position, HP, mana, mesh, movement, mana regen
    Enemy.ts          — position, HP, mesh, walk-toward-player AI
    Projectile.ts     — position, velocity, mesh, lifetime/range tracking
  /spells
    SpellDefinitions.ts  — Fireball data object (Phase 1 only)
    SpellCaster.ts       — cast(), cooldown tracking, mana deduction
  /dungeon
    Room.ts           — hardcoded rectangular room, wall meshes, bounds
  /ui
    HUD.ts            — DOM-based HP bar, mana bar, Q spell slot + cooldown
  /utils
    CollisionUtils.ts — AABB overlap (XZ plane), sphere-vs-AABB
  constants.ts        — all magic numbers
index.html
src/main.ts           — instantiates Game, calls game.start()
styles.css
```

**Rules:**
- No barrel files (no `index.ts` re-exports)
- One class or one logical unit per file
- No circular dependencies
- `Game.ts` orchestrates but does not implement

---

## Scene & Camera

**Camera:** `OrthographicCamera` positioned at `(0, 20, 14)`, looking at `(0, 0, 0)`.  
- Produces ~55° pitch at 45° yaw — Diablo/Hades isometric feel  
- Frustum driven by `VIEW_WIDTH` constant (default: 30 units) — easy to tune  
- Camera does not move in Phase 1

**Renderer:** `WebGLRenderer({ antialias: true })`, fills window. `SceneManager` handles `window.resize`.

**Lighting:**
- `AmbientLight` — soft white, intensity 0.6
- `DirectionalLight` — warm white, positioned upper-left, shadows off

**Floor:** `PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT)` rotated onto XZ plane. `MeshStandardMaterial` dark grey. Canvas-generated grid texture for dungeon tile feel.

---

## Room

`Room.ts` builds a hardcoded 20×20 unit rectangular room.

- 4 wall segments as `BoxGeometry` slabs — north, south, east, west
- Each wall: 1 unit thick, 2 units tall (visible from isometric angle), grey `MeshStandardMaterial`
- Exposes `bounds: { minX, maxX, minZ, maxZ }` used by player clamping and collision
- No doors, corridors, or exits in Phase 1

---

## Player

| Property | Value |
|---|---|
| Geometry | `CylinderGeometry(0.4, 0.4, 1.5)` |
| Material | `MeshStandardMaterial` white |
| Start position | `(0, 0.75, 0)` |
| HP | 100 / 100 |
| Mana | 100 / 100 |
| Move speed | `PLAYER_SPEED = 6` units/sec |
| Mana regen | `MANA_REGEN_RATE = 5` mana/sec |

**Movement:**
- Arrow keys via `InputManager` (held state, not press events)
- 4-directional, diagonals allowed
- `position += direction * PLAYER_SPEED * delta`
- Clamped to `room.bounds` minus player radius — cannot exit through walls
- All movement in XZ plane; Y is fixed at `0.75`

**Last facing direction** tracked for Fireball targeting when no enemies are present.

---

## Enemy

| Property | Value |
|---|---|
| Geometry | `BoxGeometry(0.8, 1.2, 0.8)` |
| Material | `MeshStandardMaterial` red |
| Start position | `(5, 0.6, 5)` |
| HP | 40 / 40 |
| Move speed | `ENEMY_SPEED = 2` units/sec |

**AI (Phase 1):**
- Each frame: vector from enemy → player, normalized, move at `ENEMY_SPEED * delta`
- On `hp <= 0`: mesh removed from scene, entity flagged dead, removed from active list
- No spell casting in Phase 1

---

## Spell System

### Fireball (only spell in Phase 1)

```typescript
{
  id: "fireball",
  name: "Fireball",
  element: "fire",
  type: "projectile",
  damage: 30,
  manaCost: 20,
  cooldown: 1.5,   // seconds
  speed: 12,       // units/sec
  range: 20        // units from origin
}
```

### SpellCaster

- `cast(spellId, origin, direction)` — validates cooldown and mana, deducts mana, spawns `Projectile`, records `lastCastTime`
- `update(delta)` — ticks cooldown timers
- Target direction: vector from player to **nearest living enemy** (XZ Euclidean). Falls back to player's last movement direction if no enemies alive.
- Player presses `Q` → `SpellCaster.cast("fireball", ...)`

### Projectile

| Property | Value |
|---|---|
| Geometry | `SphereGeometry(0.2)` |
| Material | `MeshStandardMaterial` with `emissive: 0xff4400` |
| Motion | Fixed direction, `spell.speed * delta` per frame |
| Destroyed when | Hits enemy, travels > `spell.range`, exits room bounds |

---

## Collision Detection

All collision logic lives in `CollisionUtils.ts` as pure functions (no class, no state).

**Projectile vs Enemy:** Sphere-vs-AABB test in XZ plane each frame.  
- For every live projectile × every live enemy  
- On hit: `enemy.takeDamage(spell.damage)`, projectile destroyed  

**Player vs Walls:** Clamping only — no physics bounce. Player position constrained to `room.bounds`.

**Enemy vs Player:** No damage in Phase 1 — enemy walks into player geometry with no effect.

---

## HUD

HTML/CSS overlay (`position: absolute`, `pointer-events: none`) on top of the canvas. Updated each frame by `HUD.ts` via direct DOM manipulation.

**Top-left:**
- HP bar — red fill on grey track, label "HP", width = `(hp / maxHp) * 100%`
- Mana bar — blue fill on grey track, label "MP", width = `(mana / maxMana) * 100%`

**Bottom-center:**
- 4 spell slots styled as boxes (Q / W / E / R)
- Q slot: orange border (fire element), label "Fireball", shows "20 MP"
- W / E / R slots: dark inactive styling, no label
- Cooldown overlay on Q: darkened div, height = `(remainingCooldown / totalCooldown) * 100%`, shrinks to 0 as cooldown expires

All styles in `styles.css`. No inline styles.

---

## Game Loop

```
Game.init():
  SceneManager.init()
  Room.build()         → adds meshes to scene
  Player.spawn()       → adds mesh to scene
  Enemy.spawn()        → adds mesh to scene
  HUD.init()           → creates DOM elements

Game.start():
  requestAnimationFrame(loop)

loop(timestamp):
  delta = clock.getDelta()            // Three.js Clock
  delta = Math.min(delta, 0.1)        // cap at 100ms — prevents spiral of death
  InputManager.update()
  player.update(delta)                // movement, mana regen
  spellCaster.update(delta)           // cooldown tick
  enemy.update(delta)                 // walk toward player
  projectiles.forEach(p => p.update(delta))   // move, range/bounds check
  CollisionUtils.checkProjectiles(projectiles, enemies)
  HUD.update(player, spellCaster)     // sync bars + cooldown overlay
  SceneManager.render()               // renderer.render(scene, camera)
```

---

## Constants (`constants.ts`)

```typescript
export const ROOM_WIDTH = 20
export const ROOM_HEIGHT = 20
export const WALL_THICKNESS = 1
export const WALL_HEIGHT = 2
export const VIEW_WIDTH = 30

export const PLAYER_SPEED = 6
export const PLAYER_RADIUS = 0.4
export const MANA_REGEN_RATE = 5

export const ENEMY_SPEED = 2

export const FIREBALL_SPEED = 12
export const FIREBALL_RANGE = 20
export const FIREBALL_DAMAGE = 30
export const FIREBALL_MANA_COST = 20
export const FIREBALL_COOLDOWN = 1.5

export const DELTA_CAP = 0.1
```

---

## Out of Scope for Phase 1

The following are explicitly deferred until Phase 2+:

- Procedural dungeon generation
- Multiple rooms, corridors, doors
- More than one enemy
- More than one spell (W / E / R)
- Spell bar toggling (Tab / Bar 2)
- Enemy spell casting
- Enemy HP bar (DOM overlay above mesh)
- Minimap
- Spell book / loadout UI
- Mastery system
- Grimoire / progression
- Boss
- Death screen / victory screen
- Multiple enemy archetypes
- Claude API enemy AI
- Sound

---

## Phase 1 Success Criteria

1. Vite dev server starts, game renders in browser
2. Isometric camera shows room with visible wall faces and floor grid
3. Player (white cylinder) moves with arrow keys, cannot leave the room
4. Enemy (red box) walks toward player each frame
5. Pressing Q fires an orange glowing sphere toward the enemy
6. Sphere hits enemy → enemy HP drops → enemy disappears at 0 HP
7. HP and mana bars update in HUD
8. Q slot shows cooldown overlay draining after each cast
9. Mana decrements on cast, regens over time

When all 9 criteria pass: **"Phase 1 complete"** — stop and wait for go-ahead.
