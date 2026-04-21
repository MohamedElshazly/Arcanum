# Gameplay Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four gameplay issues — post-run reward flow (priority), particle leak, flask healing system replacing HP regen, and boss balance tuning.

**Architecture:** Surgical fixes to existing files. No new systems or abstractions. The flask system adds fields to Player, a keybind in the game loop, and a HUD counter. The reward flow rewires existing callbacks. Boss tuning changes numbers only.

**Tech Stack:** TypeScript, Three.js, vanilla DOM, CSS keyframes, localStorage.

**Spec:** `docs/superpowers/specs/2026-04-21-gameplay-fixes-design.md`

---

## Task 1: Fix Post-Run Reward Flow (Priority)

**Files:**
- Modify: `src/core/Game.ts` — rewire `endRun()`, replace `openRewardSpellbook()` with `showRewardPhase()`
- Modify: `src/ui/RunSummaryScreen.ts` — simplify to single `onContinue` callback, remove alert icon
- Modify: `src/ui/Spellbook.ts` — add empty-state rendering, add "Start New Run" button
- Modify: `styles.css` — remove `.spellbook-alert` styles, add empty-state styles

### Task 1a: Simplify RunSummaryScreen

- [ ] **Step 1: Remove `onOpenSpellbook` from RunSummaryConfig**

In `src/ui/RunSummaryScreen.ts`, change the config interface to remove `onOpenSpellbook` and make `onContinue` pass the collected spell pool:

```typescript
export interface RunSummaryConfig {
  root:       HTMLDivElement
  runData:    RunData
  inventory:  PlayerInventory
  reason:     'death' | 'victory'
  onContinue: (collectedSpellPool: string[]) => void
}
```

- [ ] **Step 2: Remove `showAlertIcon` method and simplify `show()`**

In `show()`, remove the entire block that calls `showAlertIcon()` (lines 76-80). Remove the `showAlertIcon` method entirely (lines 90-105).

Change the `doContinue()` method to pass the collected spell pool:

```typescript
private doContinue(): void {
  if (this.timerId !== null) { clearInterval(this.timerId); this.timerId = null }
  const collectedPool = this.config.runData.getCollectedSpellPool()
  this.dispose()
  this.config.onContinue(collectedPool)
}
```

The Continue button should always show without a countdown. Remove the auto-dismiss countdown logic entirely (the `setInterval` block in `show()`). The button text is just `'Continue'`:

```typescript
const btn = document.createElement('button')
btn.className   = 'run-summary-continue-btn'
btn.textContent = 'Continue'
btn.addEventListener('click', () => this.doContinue())
```

Remove the `countdown` field and `RUN_SUMMARY_AUTO_DISMISS_S` constant if they exist.

- [ ] **Step 3: Remove `.spellbook-alert` CSS**

In `styles.css`, find and remove all `.spellbook-alert` rules (around lines 850-870).

- [ ] **Step 4: Commit**

```bash
git add src/ui/RunSummaryScreen.ts styles.css
git commit -m "refactor: simplify RunSummaryScreen — remove alert icon, pass spell pool via onContinue"
```

### Task 1b: Add Empty-State and Start New Run Button to Spellbook

- [ ] **Step 5: Add empty-state support to Spellbook**

In `src/ui/Spellbook.ts`, in the `show()` method, after building the book structure, add a branch: if `this.config.owner === 'enemy'` and `this.config.spells.length === 0`, render an empty-state message instead of spell cards.

Find where the left page content is built for the enemy owner case. After the page element is created, add:

```typescript
if (this.config.spells.length === 0) {
  const emptyMsg = document.createElement('div')
  emptyMsg.className = 'spellbook-empty-msg'
  emptyMsg.textContent = 'No spellbooks collected this run'
  leftPage.appendChild(emptyMsg)
}
```

Skip rendering spell cards/grid when spells array is empty.

- [ ] **Step 6: Add "Start New Run" button to enemy spellbook**

In the enemy spellbook's right page (or bottom area), replace the existing "Confirm & Continue" button with "Start New Run". The button should call `onConfirm` with the claimed spells result (same as existing behavior — the flow after confirm is handled by Game.ts).

Find the enemy confirm button creation (around line 484-493). Change the button text:

```typescript
btn.textContent = 'Start New Run'
```

If no spells were collected (empty state), the button should still appear and still call `onConfirm` with an empty `claimedSpells` array.

- [ ] **Step 7: Add empty-state CSS**

In `styles.css`, add:

```css
.spellbook-empty-msg {
  font-family: 'Cinzel', serif;
  font-size: 14px;
  color: #6a5030;
  text-align: center;
  padding: 40px 20px;
  font-style: italic;
  line-height: 1.6;
}
```

- [ ] **Step 8: Commit**

```bash
git add src/ui/Spellbook.ts styles.css
git commit -m "feat: add empty-state rendering and Start New Run button to Spellbook"
```

### Task 1c: Rewire Game.ts Flow

- [ ] **Step 9: Replace `openRewardSpellbook` with `showRewardPhase` in Game.ts**

In `src/core/Game.ts`, change the `endRun()` method. Remove `onOpenSpellbook` from the config object. Change `onContinue` to accept the spell pool and call the new method:

```typescript
private endRun(reason: 'death' | 'victory'): void {
  this.running = false
  cancelAnimationFrame(this.rafId)

  this.mastery.save()
  this.grimoire.save()
  this.inventory.save()

  const totalRuns = parseInt(localStorage.getItem('total_runs') ?? '0', 10) + 1
  localStorage.setItem('total_runs', String(totalRuns))
  if (reason === 'victory') {
    const totalWins = parseInt(localStorage.getItem('total_wins') ?? '0', 10) + 1
    localStorage.setItem('total_wins', String(totalWins))
  }

  this.evolutionOverlay.dispose()

  this.runSummaryScreen = new RunSummaryScreen({
    root:       document.getElementById('run-summary-root') as HTMLDivElement,
    runData:    this.runData,
    inventory:  this.inventory,
    reason,
    onContinue: (collectedSpellPool) => this.showRewardPhase(collectedSpellPool),
  })
  this.runSummaryScreen.show()
}
```

- [ ] **Step 10: Write `showRewardPhase` method**

Replace the existing `openRewardSpellbook` method with:

```typescript
private showRewardPhase(spellPool: string[]): void {
  // Dispose run summary first
  if (this.runSummaryScreen) { this.runSummaryScreen.dispose(); this.runSummaryScreen = null }

  const root = document.getElementById('loadout-root') as HTMLDivElement

  const rewardBook = new Spellbook({
    root,
    owner: 'enemy',
    spells: spellPool,
    inventory: this.inventory,
    booksCollected: this.runData.collectedBooks.length,
    maxPicks: 3,
    onConfirm: (result) => {
      if (result.claimedSpells) {
        for (const spellId of result.claimedSpells) {
          this.inventory.addToPool(spellId)
          this.grimoire.absorbBook([spellId])
        }
      }
      rewardBook.dispose()
      this.returnToLoadout()
    },
  })
  rewardBook.show()
}
```

Key differences from old `openRewardSpellbook`:
1. Disposes `RunSummaryScreen` before showing reward book (fixes z-index stacking bug)
2. After confirm, calls `this.returnToLoadout()` to go to the loadout screen
3. Works with empty `spellPool` (Spellbook now handles that)

- [ ] **Step 11: Clean up `returnToLoadout`**

Update `returnToLoadout` to not double-dispose the run summary (it's already disposed in `showRewardPhase`):

```typescript
private returnToLoadout(): void {
  if (this.runSummaryScreen) { this.runSummaryScreen.dispose(); this.runSummaryScreen = null }
  this.session.dispose(this.sceneManager.scene)
  this.projectiles   = []
  this.activeEffects = []
  this.showLoadoutScreen()
}
```

This is the same as before — the guard `if (this.runSummaryScreen)` handles both paths safely.

- [ ] **Step 12: Commit**

```bash
git add src/core/Game.ts
git commit -m "fix: sequential post-run flow — summary → reward spellbook → loadout"
```

---

## Task 2: Fix Particle Leak on Orb Collection

**Files:**
- Modify: `src/dungeon/DungeonSession.ts` — dispose collected orbs before filtering

- [ ] **Step 1: Add dispose call before filter in `idleTick`**

In `src/dungeon/DungeonSession.ts`, find lines 129-133 (the orb update loop and filter). Change to:

```typescript
    // Update orbs
    for (const orb of this.orbs) {
      orb.update(delta, player.position)
    }
    for (const orb of this.orbs) {
      if (orb.collected) orb.dispose(scene)
    }
    this.orbs = this.orbs.filter(o => !o.collected)
```

The new `for` loop iterates all orbs, calling `dispose(scene)` on any that have `collected === true`. This removes their 7 Three.js objects (5 particle meshes + 1 main mesh + 1 point light) from the scene and frees GPU resources. The existing filter line then removes them from the tracking array.

- [ ] **Step 2: Commit**

```bash
git add src/dungeon/DungeonSession.ts
git commit -m "fix: dispose collected orbs before filtering — prevents particle leak across rooms"
```

---

## Task 3: Flask Healing System

**Files:**
- Modify: `src/entities/Player.ts` — remove HP regen, add flask fields and heal logic
- Modify: `src/core/Game.ts` — add Space keybind, flask drop on enemy death, reset on run start
- Modify: `src/ui/HUD.ts` — add flask counter display
- Modify: `src/dungeon/DungeonSession.ts` — change shrine to flask refill
- Modify: `src/dungeon/DungeonGenerator.ts` — restrict rest rooms to pre-boss only
- Modify: `styles.css` — flask counter styles and animations
- Modify: `index.html` — add flask counter DOM element

### Task 3a: Add Flask Fields to Player and Remove HP Regen

- [ ] **Step 1: Modify Player.ts**

In `src/entities/Player.ts`:

1. Remove the `HP_REGEN_RATE` constant (line 7).
2. Add flask fields after the existing fields (after line 25):

```typescript
  // Flask healing
  flasks         = 5
  maxFlasks      = 5
  flaskHealPercent = 0.5   // heals 50% of maxHp
  isHealing      = false
  healTimer      = 0
```

3. Add a constant for cast time at the top of the file (near the other constants):

```typescript
const FLASK_CAST_TIME = 1.0  // seconds — vulnerable during this window
```

4. In the `update()` method, remove the HP regen line (line 83: `this.hp = Math.min(this.maxHp, this.hp + HP_REGEN_RATE * delta)`). Keep the mana regen line.

5. At the top of `update()`, add the heal timer logic (before movement processing):

```typescript
    // Flask heal timer
    if (this.isHealing) {
      this.healTimer -= delta
      if (this.healTimer <= 0) {
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.flaskHealPercent)
        this.isHealing = false
        this.healTimer = 0
        // Remove green tint
        const mat = this.mesh.material as THREE.MeshStandardMaterial
        mat.emissive.set(0x000000)
      }
      return  // Cannot move or act while healing
    }
```

6. Add a `useFlask()` method after `takeDamage()`:

```typescript
  useFlask(): boolean {
    if (this.flasks <= 0 || this.isHealing || this.hp >= this.maxHp || this.hp <= 0) return false
    this.flasks -= 1
    this.isHealing = true
    this.healTimer = FLASK_CAST_TIME
    // Green tint during heal
    const mat = this.mesh.material as THREE.MeshStandardMaterial
    mat.emissive.set(0x003300)
    return true
  }

  addFlask(): boolean {
    if (this.flasks >= this.maxFlasks) return false
    this.flasks += 1
    return true
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/entities/Player.ts
git commit -m "feat: add flask healing to Player, remove passive HP regen"
```

### Task 3b: Add Flask HUD Counter

- [ ] **Step 3: Add flask counter DOM element to index.html**

In `index.html`, inside the `#hud-topleft` div (after the mana bar wrap), add:

```html
<div id="flask-counter">
  <span id="flask-icon">&#x1F9EA;</span>
  <span id="flask-count">5</span>
</div>
```

- [ ] **Step 4: Add flask counter CSS**

In `styles.css`, add after the existing HUD styles (find the `#hud-topleft` rules):

```css
#flask-counter {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-family: 'Cinzel', serif;
  font-size: 14px;
  color: #44dd44;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
}

#flask-icon {
  font-size: 16px;
  filter: hue-rotate(90deg);
}

#flask-count {
  transition: transform 0.15s ease;
}

#flask-count.pulse {
  transform: scale(1.5);
}

#flask-count.used {
  transform: scale(0.8);
}
```

- [ ] **Step 5: Wire flask counter in HUD.ts**

In `src/ui/HUD.ts`:

1. Add a field for the flask counter element:

```typescript
private flaskCount!: HTMLElement
```

2. In `init()`, grab the element:

```typescript
this.flaskCount = document.getElementById('flask-count')!
```

3. In `update()`, after the mana bar update (line 68), add:

```typescript
this.flaskCount.textContent = String(player.flasks)
```

4. Add a method to trigger the pickup pulse animation:

```typescript
pulseFlask(): void {
  this.flaskCount.classList.remove('pulse')
  void this.flaskCount.offsetWidth
  this.flaskCount.classList.add('pulse')
  this.flaskCount.addEventListener('animationend', () => {
    this.flaskCount.classList.remove('pulse')
  }, { once: true })
  // Fallback removal
  setTimeout(() => this.flaskCount.classList.remove('pulse'), 300)
}

dimFlask(): void {
  this.flaskCount.classList.remove('used')
  void this.flaskCount.offsetWidth
  this.flaskCount.classList.add('used')
  setTimeout(() => this.flaskCount.classList.remove('used'), 200)
}
```

- [ ] **Step 6: Commit**

```bash
git add index.html styles.css src/ui/HUD.ts
git commit -m "feat: add flask counter to HUD with pulse/dim animations"
```

### Task 3c: Wire Flask Usage and Drops in Game Loop

- [ ] **Step 7: Add Space keybind in Game.ts loop**

In `src/core/Game.ts`, in the `loop()` method, after the spell slot key checks (after line 180), add:

```typescript
    // Flask usage — Space key
    if (this.inputManager.isJustPressed('Space')) {
      if (this.player.useFlask()) {
        this.hud.dimFlask()
      }
    }
```

- [ ] **Step 8: Block spell casting while healing**

In the `loop()` method, wrap the spell slot key checks with a healing guard:

```typescript
    if (!this.player.isHealing) {
      for (let slotIdx = 0; slotIdx < 4; slotIdx++) {
        if (this.inputManager.isJustPressed(SLOT_KEYS[slotIdx])) {
          this.attemptCast(slotIdx, currentTime)
        }
      }

      // Flask usage — Space key
      if (this.inputManager.isJustPressed('Space')) {
        if (this.player.useFlask()) {
          this.hud.dimFlask()
        }
      }
    }
```

- [ ] **Step 9: Add flask drop on enemy death**

In `Game.ts`, find where `this.session.onEnemyDied` is assigned (around line 134-136 in `startRun`). Change it to also roll for a flask drop:

```typescript
    this.session.onEnemyDied = (_spellIds, _element, _pos) => {
      this.runData.enemiesDefeated++
      // 15% chance to drop a flask charge
      if (Math.random() < 0.15) {
        if (this.player.addFlask()) {
          this.hud.pulseFlask()
        }
      }
    }
```

- [ ] **Step 10: Reset flasks on run start**

In `Game.ts`, in `startRun()` (around line 127-129 where player stats are reset), add:

```typescript
    this.player.flasks    = this.player.maxFlasks
    this.player.isHealing = false
    this.player.healTimer = 0
```

- [ ] **Step 11: Commit**

```bash
git add src/core/Game.ts
git commit -m "feat: wire flask usage (Space key), enemy drops (15%), run start reset"
```

### Task 3d: Change Shrine to Flask Refill and Restrict to Pre-Boss

- [ ] **Step 12: Change shrine behavior in DungeonSession.ts**

In `src/dungeon/DungeonSession.ts`, find the shrine logic (lines 141-148). Change it from HP heal to flask refill:

```typescript
    if (this.activeRoomData.type === 'rest' && !this.shrineUsed) {
      if (player.position.distanceTo(new THREE.Vector3(0, 0, 0)) < 2) {
        player.flasks = player.maxFlasks
        player.mana   = Math.min(player.maxMana, player.mana + 30)
        this.shrineUsed = true
        this.flashPlayer(player)
      }
    }
```

- [ ] **Step 13: Restrict rest rooms to pre-boss only in DungeonGenerator.ts**

In `src/dungeon/DungeonGenerator.ts`, replace the dead-end rest room selection logic (lines 122-129) with logic that places exactly one rest room immediately before the boss room:

```typescript
  // Place one shrine room adjacent to boss (the room just before boss on the path)
  const preBossCell = path[path.length - 2]  // second-to-last cell is right before boss
  const restKeys = new Set([`${preBossCell.x},${preBossCell.y}`])
```

This replaces the old logic that randomly selected 1-2 dead-end rooms. Now exactly one rest room is placed at the cell just before the boss on the path. The room type assignment switch (lines 134-139) already handles `restKeys.has(key)` → `type = 'rest'`, so no changes needed there.

Edge case: if `preBossCell` happens to be the start cell, it would conflict with the `startKey` check (line 135 takes priority: `if (key === startKey) type = 'start'`). This is fine — in a dungeon of 10-14 rooms, the second-to-last room will never be the start room.

However, we need to make sure the pre-boss rest room doesn't get overridden by the `elite` type. Currently elite rooms are boss-adjacent (lines 116-120). The pre-boss cell IS boss-adjacent. The type priority on lines 135-139 is: start > boss > elite > rest. So `elite` would take priority over `rest`.

Fix: add the pre-boss cell to `restKeys` and check `rest` before `elite` in the priority chain. Change lines 135-139:

```typescript
    if      (key === startKey)                          type = 'start'
    else if (key === bossKey)                           type = 'boss'
    else if (restKeys.has(key))                         type = 'rest'
    else if (bossAdjacentKeys.has(key))                 type = 'elite'
    else                                                type = 'normal'
```

This ensures the pre-boss shrine room takes priority over the elite tag.

- [ ] **Step 14: Commit**

```bash
git add src/dungeon/DungeonSession.ts src/dungeon/DungeonGenerator.ts
git commit -m "feat: shrine refills flasks, restricted to pre-boss room only"
```

---

## Task 4: Boss Balance Tuning

**Files:**
- Modify: `src/entities/Enemy.ts` — update boss constants

- [ ] **Step 1: Update base HP and scaling caps**

In `src/entities/Enemy.ts`:

1. Change boss base HP (line 21):
```typescript
const BASE_HP: Record<EnemyArchetype, number> = { apprentice: 40, battle_mage: 80, boss: 500 }
```

2. Change scaling caps in `scaleEnemyStats` (lines 25-26):
```typescript
  const hpD    = Math.min(depth, archetype === 'boss' ? 12 : 8)
  const speedD = Math.min(depth, archetype === 'boss' ? 10 : 6)
```

- [ ] **Step 2: Update boss projectile count per phase**

Find line 466 (`const spreadCount = ...`). Change to:

```typescript
const spreadCount = this.phase === 1 ? 2 : this.phase === 2 ? 4 : 7
```

- [ ] **Step 3: Update boss damage modifier**

Find line 250 (`damage: Math.round(next.spell.damage * 0.60)`). Change to:

```typescript
const mod = { ...next.spell, damage: Math.round(next.spell.damage * 0.75) }
```

- [ ] **Step 4: Update boss cast intervals per phase**

Find lines 269-276 (`activeCastInterval`). Change to:

```typescript
private activeCastInterval(): number {
  if (this.archetype !== 'boss') return this.stats.castInterval
  switch (this.phase) {
    case 1: return this.stats.castInterval * 0.85
    case 2: return this.stats.castInterval * 0.55
    case 3: return this.stats.castInterval * 0.30
  }
}
```

- [ ] **Step 5: Update queue drain interval**

Find line 251 (`this.bossQueueTimer = 0.8`). Change to:

```typescript
this.bossQueueTimer = 0.5
```

- [ ] **Step 6: Update Phase 3 speed multiplier**

Find line 291 (`this.stats.speed * 1.8`). Change to:

```typescript
const spd = this.phase === 3 ? this.stats.speed * 2.2 : this.stats.speed
```

- [ ] **Step 7: Update blink telegraph time**

Find line 208 (`const telegraphTime = this.archetype === 'boss' ? 1.0 : 0.6`). Change to:

```typescript
const telegraphTime = this.archetype === 'boss' ? 0.6 : 0.6
```

Since both values are now 0.6, simplify to:

```typescript
const telegraphTime = 0.6
```

- [ ] **Step 8: Update phase break duration**

Find line 221 (`this.bossPhaseBreak = 1.5`). Change to:

```typescript
this.bossPhaseBreak = 0.6
```

- [ ] **Step 9: Commit**

```bash
git add src/entities/Enemy.ts
git commit -m "feat: boss balance tuning — more HP, faster attacks, tighter windows"
```

---

## Task 5: Final Verification

- [ ] **Step 1: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Run the dev server and manually test**

```bash
npm run dev
```

Test checklist:
- [ ] Run starts → flask counter shows "5" on HUD
- [ ] Press Space → player heals 50% HP after 1s cast, green tint visible, flask count decrements
- [ ] Space while full HP → nothing happens
- [ ] Space with 0 flasks → nothing happens
- [ ] Cannot move or cast during flask animation
- [ ] Kill enemies → occasional flask drop with counter pulse
- [ ] Reach pre-boss shrine room → flasks refill to 5, mana +30
- [ ] No other shrine rooms in dungeon
- [ ] Boss fight: Phase 1 fires 2 projectiles, Phase 2 fires 4, Phase 3 fires 7
- [ ] Boss feels harder but not impossible
- [ ] After run ends → Summary screen shows → press Continue → Spellbook reward shows
- [ ] If books collected → spells shown, can claim, then "Start New Run" → loadout screen
- [ ] If no books → "No spellbooks collected this run" text, "Start New Run" → loadout screen
- [ ] No particle effects lingering between rooms after picking up orbs
- [ ] No console errors

- [ ] **Step 3: Final commit if any tweaks needed**

```bash
git add -A
git commit -m "fix: final adjustments from manual testing"
```
