# Gameplay Fixes — Particle Leak, Flask Healing, Boss Balance, Reward Flow

**Date:** 2026-04-21
**Scope:** Four independent fixes applied to the existing codebase. No new systems — surgical changes to existing files.

---

## 1. Particle Leak Fix

### Problem

When spell book orbs are collected, `DungeonSession.idleTick()` filters them out of `this.orbs` via `this.orbs = this.orbs.filter(o => !o.collected)` without calling `dispose()`. The 7 Three.js objects per orb (5 particle meshes + 1 main mesh + 1 point light) remain orphaned in the scene, accumulating across rooms and causing increasing lag.

### Fix

In `DungeonSession.idleTick()`, before the filter line, iterate collected orbs and call `dispose(scene)`:

```typescript
for (const orb of this.orbs) {
  if (orb.collected) orb.dispose(scene)
}
this.orbs = this.orbs.filter(o => !o.collected)
```

**Files changed:** `src/dungeon/DungeonSession.ts` (2 lines added)

---

## 2. Flask Healing System

### What Changes

- **Remove** passive HP regeneration (2 HP/sec) from `Player.update()`. Keep mana regen unchanged.
- **Add** a consumable flask system bound to Space key.
- **Repurpose** rest shrines to refill flask charges instead of direct HP heal.

### Player State

New fields on `Player`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `flasks` | number | 5 | Current flask charges |
| `maxFlasks` | number | 5 | Maximum flask charges |
| `flaskHealPercent` | number | 0.5 | Heals 50% of maxHP per use |
| `isHealing` | boolean | false | Currently in flask animation |
| `healTimer` | number | 0 | Time remaining in heal cast |

Constants: `FLASK_CAST_TIME = 1.0` (seconds of vulnerable animation).

### Usage Flow

1. Player presses Space
2. Guard checks: `flasks > 0`, `!isHealing`, `hp < maxHp`, player is alive
3. If all pass: `isHealing = true`, `healTimer = FLASK_CAST_TIME`, `flasks -= 1`
4. During heal: player cannot move or cast spells. Player mesh gets a green tint (emissive color pulse) as visual feedback.
5. Player CAN take damage during the heal — the animation is committed (like Dark Souls Estus).
6. When `healTimer` reaches 0: apply `hp = Math.min(maxHp, hp + maxHp * flaskHealPercent)`, reset `isHealing = false`, remove tint.
7. If player dies during heal animation, heal is cancelled (irrelevant — player is dead).

### Input Binding

- Check `inputManager.isJustPressed('Space')` in `Game.loop()`, after spell slot checks.
- `InputManager` already prevents default on Space (line 35). No changes needed there.

### Enemy Flask Drops

- On enemy death, 15% chance to drop a flask charge.
- Drop is instant: `player.flasks = Math.min(player.maxFlasks, player.flasks + 1)`.
- No ground pickup — charge is added immediately.
- HUD flask counter plays a scale-up pulse animation on pickup.

### Rest Shrine Change

- `DungeonSession` rest shrine (currently +30 HP, +30 mana) changes to: refill all flask charges to `maxFlasks`, +30 mana (keep mana restore).
- The `shrineUsed` gate remains — one use per room.

### HUD Display

- New flask counter element next to HP bar in `#hud-topleft`.
- Displays flask icon (text "F" in a styled circle, or a simple potion emoji) + number.
- On flask use: number decrements, brief fade transition.
- On flask pickup: number increments, scale-up pulse animation (CSS keyframe, ~0.3s).
- During healing: the flask counter or HP bar could show a subtle green pulse to indicate healing in progress.

### Run Start Reset

On `Game.startRun()`, reset `player.flasks = player.maxFlasks`. The player always enters a run with full flask charges.

### Movement/Cast Lock During Heal

- `Player.update()`: if `isHealing`, skip movement processing, decrement `healTimer`.
- `Game.loop()`: if `player.isHealing`, skip spell cast key checks.
- The heal timer countdown happens in `Player.update()` — when it reaches 0, apply the heal and reset state.

### Files Changed

| File | Changes |
|------|---------|
| `src/entities/Player.ts` | Remove HP regen, add flask fields, heal logic, movement lock |
| `src/core/Game.ts` | Add Space key check, pass flask drop to player on enemy death |
| `src/ui/HUD.ts` | Add flask counter display with animations |
| `src/dungeon/DungeonSession.ts` | Change rest shrine from HP heal to flask refill |
| `styles.css` | Flask counter styles, pulse animation keyframe |

---

## 3. Boss Balance Tuning

### Problem

The boss is too easy: weak per-projectile damage (60% modifier vs regular enemy 65%), generous free-damage windows on phase transitions, single shots in Phase 1, stat scaling caps at depth 8 while boss sits at depth 10-13, and player moves 2.4-4.3x faster.

### Tuning Changes

All changes are to existing constants/formulas in `Enemy.ts`. No new mechanics, no adds.

| Parameter | Current | New | Notes |
|-----------|---------|-----|-------|
| Boss base HP | 350 | 500 | ~43% more durable |
| HP scaling cap depth | 8 | 12 | Boss benefits from deeper dungeon placement |
| Speed scaling cap depth | 6 | 10 | Same reason |
| Phase 1 projectile count | 1 | 2 | No more single-shot Phase 1 |
| Phase 2 projectile count | 3 | 4 | Moderate increase |
| Phase 3 projectile count | 5 | 7 | Dangerous but not impossible |
| Phase transition pause | 1.5s | 0.6s | Much shorter free-damage window |
| Cast interval Phase 1 | base | base * 0.85 | Slightly faster from the start |
| Cast interval Phase 2 | base * 0.65 | base * 0.55 | Noticeably faster |
| Cast interval Phase 3 | base * 0.35 | base * 0.30 | Pressure in final phase |
| Boss damage modifier | 0.60 | 0.75 | Each hit matters more |
| Queue drain interval | 0.8s | 0.5s | Volleys come faster |
| Phase 3 speed multiplier | 1.8x | 2.2x | More aggressive chase |
| Blink telegraph time | 1.0s | 0.6s | Harder to react to |

### Design Intent

- Phase 1 is no longer a free DPS window — 2 projectiles at tighter intervals require movement.
- Phase 2 becomes the "learning phase" — 4-shot volleys with faster drain punish standing still.
- Phase 3 is a sprint to the finish — 7-shot volleys, fast chase speed, quick blinks. The player should feel pressure to end the fight.
- Phase transition pauses shortened from 1.5s to 0.6s — still a brief visual cue but not a vacation.
- With flask healing (5 charges, 50% HP each), the player has enough sustain to survive mistakes but not unlimited attempts.

### Files Changed

| File | Changes |
|------|---------|
| `src/entities/Enemy.ts` | Update boss constants: base HP, projectile counts, cast intervals, damage modifier, queue drain, speed multiplier, blink telegraph, scaling caps |

---

## 4. Post-Run Reward Flow Fix

### Problem

The reward spellbook renders into `#loadout-root` (z-index 100) but `RunSummaryScreen` (z-index 150) is never hidden, so the spellbook is completely obscured. The prior fix addressed timing but not this stacking issue.

### New Flow (Sequential)

```
Run ends (victory or death)
  → RunSummaryScreen shows (stats, run data)
  → "Continue" button at bottom
  → Player clicks Continue
  → RunSummaryScreen hides
  → Reward Spellbook shows:
      - If books were collected: spellbook with collected spells, player can absorb/discard
      - If no books collected: spellbook with centered text "No spellbooks collected this run"
  → "Start New Run" button at bottom of reward screen
  → Player clicks Start New Run
  → Reward screen hides
  → LoadoutScreen shows
```

### Implementation

**RunSummaryScreen changes:**
- Remove the alert icon system entirely (`showAlertIcon` method and related CSS).
- The "Continue" button always shows (no conditional on collected books).
- `onContinue` callback receives the collected spell pool (may be empty).

**Game.ts flow changes:**
- `endRun()` creates `RunSummaryScreen` with `onContinue: (spellPool) => this.showRewardPhase(spellPool)`.
- New method `showRewardPhase(spellPool: string[])`:
  1. Dispose `RunSummaryScreen`
  2. If spellPool is non-empty: show reward Spellbook with collected spells
  3. If spellPool is empty: show a simple reward screen with "No spellbooks collected this run" text
  4. Both cases show a "Start New Run" button
  5. On "Start New Run" click: dispose reward UI, call `showLoadoutScreen()`

**Reward screen (empty case):**
- Reuses `#loadout-root` as container
- Shows the open book background (same as LoadoutScreen)
- Centered text on the book pages: "No spellbooks collected this run"
- "Start New Run" button below

**Reward screen (has spells case):**
- Uses existing Spellbook component with `owner: 'enemy'`
- After spell selection/absorption, "Start New Run" button appears
- On confirm: dispose Spellbook, show LoadoutScreen

### Files Changed

| File | Changes |
|------|---------|
| `src/core/Game.ts` | New `showRewardPhase()` method, rewire `endRun()` callbacks |
| `src/ui/RunSummaryScreen.ts` | Remove alert icon, simplify Continue to pass spell pool |
| `src/ui/Spellbook.ts` | Add empty-state rendering support |
| `styles.css` | Remove `.spellbook-alert` styles, add empty-state styles |

---

## Execution Order

These four fixes are independent and can be implemented in any order. Recommended priority:

1. **Reward flow fix** — user-reported twice, highest priority
2. **Particle leak fix** — performance impact, surgical fix
3. **Flask healing system** — largest change, most new code
4. **Boss balance tuning** — numbers-only change, should be tuned after flask system is in (since flask availability affects difficulty)
