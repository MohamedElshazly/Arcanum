# Phase 3 — Procedural Dungeon + Biomes + Enemy Scaling

**Date:** 2026-04-18
**Status:** Approved

---

## Scope

Phase 3 replaces the hardcoded single room with a fully procedural dungeon:

- Connected rooms and corridors with room-to-room navigation
- 6 biomes that shift as the player delves deeper
- Per-biome hazards that affect gameplay
- Two enemy archetypes that scale in stats and behavior with depth
- Minimap (150×150px canvas, top-right HUD)
- Smooth isometric camera follow (lerp factor 0.08), snap on transition

**Out of scope:** boss fight, spell book drops, pre-run loadout, progression systems, spell system changes.

---

## Architecture Decision

**DungeonSession (Option B)** — a dedicated class owns all dungeon state and the transition state machine. `Game.ts` holds one instance and calls `session.update(delta, player, scene)` each frame. This keeps `Game.ts` lean while isolating dungeon logic.

---

## File Structure

### New files

| File | Role |
|---|---|
| `src/dungeon/BiomeDefinitions.ts` | Pure data — 6 biome definitions |
| `src/dungeon/BiomeAssigner.ts` | BFS depth → biome + hazardCount assignment |
| `src/dungeon/DungeonGenerator.ts` | 7×7 grid walk, room classification, enemy spawn data |
| `src/dungeon/HazardSystem.ts` | Hazard spawn / update / despawn |
| `src/dungeon/DungeonRenderer.ts` | Biome visuals: floor/wall colors, fog, lighting, particles |
| `src/dungeon/DungeonSession.ts` | Owns DungeonData, active Room, transition state machine |
| `src/utils/MathUtils.ts` | mulberry32 seeded RNG |

### Modified files

| File | Change |
|---|---|
| `src/dungeon/Room.ts` | Full replacement — multi-room class with doors, enemies, hazards, particles |
| `src/entities/Enemy.ts` | Add EnemyConfig, two archetypes, depth scaling, Blink AI + telegraphing |
| `src/ui/HUD.ts` | Add minimap canvas |
| `src/core/Game.ts` | Thin out — delegate dungeon to DungeonSession |
| `src/core/SceneManager.ts` | Add followPlayer() + snapToRoom() |

---

## Data Types

```typescript
// src/dungeon/BiomeDefinitions.ts
export type BiomeType = "stone" | "fire" | "ice" | "lightning" | "arcane" | "void"

export interface HazardDefinition {
  type: "lava_patch" | "ice_floor" | "storm_zone" | "void_rift"
  radius: number
  effect: "damage_over_time" | "slow" | "random_knockback" | "mana_drain"
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
```

```typescript
// src/dungeon/DungeonGenerator.ts
export type RoomType = "start" | "normal" | "elite" | "rest" | "boss"
export type Direction = "north" | "south" | "east" | "west"

export interface RoomData {
  id: string
  gridX: number
  gridY: number
  type: RoomType
  biome: BiomeType
  depth: number
  hazardCount: number          // 0–3
  connections: Direction[]
  enemies: EnemySpawnData[]
  cleared: boolean
  visited: boolean
}

export interface EnemySpawnData {
  archetype: "apprentice" | "battle_mage"
  spellIds: string[]
  position: { x: number; z: number }
  depth: number
}

export interface DungeonData {
  grid: (RoomData | null)[][]  // 7×7
  rooms: RoomData[]
  startRoom: RoomData
  bossRoom: RoomData
}
```

```typescript
// src/entities/Enemy.ts
export interface EnemyConfig {
  archetype: "apprentice" | "battle_mage"
  spells: Spell[]
  depth: number
  biome: BiomeType
}
```

---

## Biomes

### Stone (depth 0–2 baseline)
- Floor: `#1a1a1a` | Wall: `#2a2a2a` | Ambient: white, low intensity
- No dominant element, equal weights | No hazards
- Particles: sparse dust (tiny grey spheres, slow random drift)
- Description: *"Ancient stone corridors, cold and silent."*

### Fire
- Floor: `#1a0800` | Wall: `#2a1000` | Ambient: `#ff4400`, medium
- Dominant: fire (70%), others 10% each
- Hazard: `lava_patch` — emissive orange flat cylinder, 8 dmg/s on contact
- Particles: rising orange embers (drift upward, fade out, respawn)
- Description: *"The air shimmers with heat. The walls weep molten rock."*

### Ice
- Floor: `#0a1520` | Wall: `#0d1f2d` | Ambient: `#aaddff`, low
- Dominant: ice (70%)
- Hazard: `ice_floor` — pale blue cylinder, 40% slow while standing on it
- Particles: tiny white spheres, slow horizontal drift
- Description: *"Frost coats every surface. Your breath fogs the air."*

### Lightning
- Floor: `#0f0f1a` | Wall: `#1a1a2a` | Ambient: `#ccccff`, high (flickers via sin oscillation)
- Dominant: lightning (70%)
- Hazard: `storm_zone` — faint yellow cylinder, random knockback pulse every 2s
- Particles: small bright sparks, random arc directions
- Description: *"Static fills the air. Every surface hums with charge."*

### Arcane
- Floor: `#0a0015` | Wall: `#150025` | Ambient: `#8800ff`, medium
- Dominant: arcane (70%)
- Hazard: `void_rift` — black cylinder with purple emissive ring, 8 mana/s drain, slow rotation
- Particles: slowly orbiting purple motes
- Description: *"Reality feels thin here. Magic bends in unexpected ways."*

### Void (boss room only)
- Floor: `#000000` | Wall: `#050005` | Ambient: `#330011`, high
- All element weights equal | All hazard types may appear at room edges
- Particles: all particle types mixed, denser and faster
- Description: *"Something ancient waits here. The air tastes of endings."*

---

## Dungeon Generation

1. Create 7×7 grid, all cells null
2. Pick random non-edge starting cell using seeded RNG (mulberry32)
3. Random walk from start, visiting 10–14 cells total
4. Adjacent visited cells share a corridor (bidirectional connection)
5. Classify rooms:
   - First cell → Start
   - Last cell → Boss
   - Cells adjacent to Boss → Elite
   - Dead ends (1 connection, not Start/Boss) → Rest candidates (pick 1–2)
   - Everything else → Normal
6. BFS from Start → assign `depth` to every room
7. Call `BiomeAssigner.assignBiomes()` — picks one run-dominant SpellElement randomly

### Biome depth rules
| Depth | Biome | hazardCount (normal rooms) |
|---|---|---|
| 0 (Start) | Stone | 0 |
| 1–2 | Stone 80%, random element 20% | 0 |
| 3–4 | Run-dominant element biome | 1 |
| 5–6 | Run-dominant element biome | 2 |
| 7+ | Run-dominant element biome | 3 |
| Boss room | Void (always) | 3 |
| Elite rooms | Same as depth range | 3 (always max) |

### Enemy placement per room
- Start: no enemies
- Rest: no enemies
- Boss: no enemies (boss entity deferred to Phase 4)
- Normal/Elite: enemies generated by depth rules below

---

## Hazard System

### Placement rules
- Never within 4 units of a door gap
- Never within 3 units of an enemy spawn point
- Minimum 3 units between hazards
- hazardCount 0 → none; 1 → 1–2; 2 → 2–4; 3 → 4–6

### Hazard visuals
| Type | Visual |
|---|---|
| `lava_patch` | Flat cylinder, emissive orange, pulsing scale (sin) |
| `ice_floor` | Flat cylinder, pale blue, slightly transparent |
| `storm_zone` | Flat cylinder, faint yellow, pulsing opacity + spark particles above |
| `void_rift` | Flat cylinder, black center + purple emissive ring, slow rotation |

All hazards brighten slightly when player is within 2 units (proximity warning).

---

## Enemy Archetypes & Scaling

### Apprentice
- Base HP: 40 | Base speed: 2.5
- Behavior: moves directly toward player, casts when in range
- Visual: small box (0.8×1.2×0.8), colored by dominant spell element
- At depth 5+: gains Blink for low-HP escape (< 30% HP)

### Battle Mage
- Base HP: 80 | Base speed: 1.8
- Behavior: maintains 6–10 unit distance, strafes while casting, retreats if player closes
- Visual: taller box (0.8×1.8×0.8), colored by dominant spell element
- At depth 4+: Blinks to reposition when player within 3 units
- At depth 6+: Blinks offensively to flank

### Scaling formulas
| Stat | Formula | Cap |
|---|---|---|
| HP | `baseHP × 1.15^depth` | depth 8 |
| Speed | `baseSpeed × 1.05^depth` | depth 6 |
| Spell count | 2 (d0–2), 3 (d3–4), 4 (d5+) | — |
| Cast interval | `2.0 - (depth × 0.1)` | min 0.8s |
| Aggression range | 8u (d0–2), 12u (d3–4), immediate (d5+) | — |

At depth 5+, at least one spell must be `blink` (`phase_walk` does not exist in the spell system yet — use `blink` only).

### Element colors
`fire=#cc4400` | `ice=#4499cc` | `lightning=#cccc00` | `arcane=#9944cc` | mixed=`#888888`

---

## Mobility Spell Telegraphing (Blink/Phase Walk)

When an enemy selects a mobility spell:

1. **Telegraph (0.6s):** Spawn glowing ring at origin position + glowing ring at destination. Enemy freezes. Line connects origin → destination.
2. **Execute:** Enemy teleports to destination.
3. **After-image:** Fading ghost mesh at origin for 0.4s.

### Blink destination selection
- Low HP / being chased → blink away from player (increase distance)
- Out of cast range → blink toward player
- Never blink into a hazard
- Never blink outside room bounds

---

## Room System

### Dimensions
- Normal / Elite / Rest / Start: 20×20 units
- Boss: 30×30 units
- Corridors: 4 units wide, 8 units long

### Doors
- Closed: biome-colored box fills gap
- Open: box removed, directional arrow floats above gap
- Unvisited connected room: `?` geometry above door
- Visited: directional arrow

### Rest room shrine
- Center octahedron, emissive green, slowly rotates
- Player within 2 units → restore 30 HP + 30 mana (once per visit)
- Brief green flash on player mesh

---

## DungeonSession State Machine

```
idle
  → tick HazardSystem (player effects)
  → check door crossing → begin 'fade-out'

fade-out (0.3s)
  → drive black overlay opacity 0→1
  → on complete: despawn room, spawn next, reposition player
  → camera.snapToRoom(newRoomCenter)
  → transition to 'fade-in'

fade-in (0.3s)
  → drive overlay opacity 1→0
  → on complete: show biome description if first visit
  → transition to 'idle'
```

---

## Camera Follow (SceneManager)

Isometric offset preserved: `(+0, +20, +14)` relative to target.

```typescript
followPlayer(playerPos: Vector3, delta: number): void
  // lerp factor 0.08 per frame
  target = playerPos + (0, 20, 14)
  camera.position.lerp(target, 0.08)
  camera.lookAt(playerPos)

snapToRoom(center: Vector3): void
  camera.position.copy(center + (0, 20, 14))
  camera.lookAt(center)
```

---

## Minimap (HUD)

- 150×150px `<canvas>` element, positioned top-right
- Each room: 8×8px rect at `(gridX * 10, gridY * 10)` (with 2px padding)
- Colors: grey=normal, `#440000`=elite, `#004400`=rest, `#000000`=boss, `#ffffff`=start
- Unvisited: dark `#111` fill + faint outline | Visited: type color | Current: white 1px border
- Biome tint: semi-transparent color overlay on visited rooms
- Corridors: 1px lines between connected room centers
- Player: 3px white dot, centered in current room cell
- Redrawn every frame in `HUD.update()`

---

## Done Conditions

1. Every run generates a unique dungeon with correct room types
2. Biomes shift per depth — visuals, lighting, fog, particles all change
3. Hazards spawn and affect the player correctly
4. Enemies scale in HP, speed, spell count, and aggression with depth
5. Depth 5+ enemies use Blink with full telegraph (origin ring, destination ring, freeze, after-image)
6. Room transitions work — fade in/out, correct player repositioning
7. Doors lock on room enter, unlock on room clear
8. Rest rooms heal at the shrine (once per visit)
9. Minimap shows layout, visited state, biome tint, player position
10. Camera follows player smoothly, snaps on transition
