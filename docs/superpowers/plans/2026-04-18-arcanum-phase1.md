# Arcanum Phase 1 Implementation Plan

**Goal:** Build a playable Phase 1 of Arcanum — isometric Three.js room, arrow-key player, one enemy, Fireball spell, AABB collision, and a DOM HUD — all in Vite + TypeScript.

**Architecture:** Game.ts runs a delta-time requestAnimationFrame loop and orchestrates all systems. Pure logic (collision, cooldowns, input state) lives in focused files and is unit-tested with Vitest. Rendering code (SceneManager, Room, Player, Enemy) is verified visually. All movement is in the XZ plane; Y is always fixed.

**Tech Stack:** Vite 5, TypeScript 5 (strict), Three.js (npm, bundled types), Vitest + jsdom

---

## How to Execute This Plan (Fresh Claude Context)

This plan is executed using **Subagent-Driven Development**. Start by invoking the skill:

```
Skill("superpowers:subagent-driven-development")
```

Then follow this loop for each of the 14 tasks below:

### Per-Task Loop

**Step A — Dispatch implementer subagent**

```
Agent(general-purpose):
  description: "Implement Task N: [task name]"
  prompt: |
    You are implementing Task N: [task name]
    Working directory: /Users/omni/repos/arcanum

    ## Task Description
    [paste full task text from this plan]

    ## Context
    [see scene-setting below]

    ## Before You Begin
    Ask questions about anything unclear before starting work.

    ## Your Job
    1. Implement exactly what the task specifies
    2. Write tests (following TDD where the task requires it)
    3. Verify implementation works
    4. Commit your work
    5. Self-review before reporting

    ## Report Format
    - Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
    - What you implemented
    - Test results
    - Files changed
    - Self-review findings
```

**Scene-setting to include per task:**

| Task | Context to include |
|---|---|
| 1 — Scaffold | Greenfield project. Repo already has git init and docs/ only. Use `npm create vite@latest . -- --template vanilla-ts` and answer yes when asked to overwrite. |
| 2 — Constants | Task 1 complete. Vite+TS+Three.js scaffold in place. |
| 3 — InputManager | Tasks 1–2 complete. `src/constants.ts` exists. This is a pure-logic file with full unit tests. |
| 4 — SceneManager | Tasks 1–3 complete. Wire temporarily into `src/main.ts` for visual verification, then revert main.ts to stub (`console.log('Arcanum loading...')`). |
| 5 — Room | Tasks 1–4 complete. Wire temporarily into main.ts for visual verification, then revert. |
| 6 — Player | Tasks 1–5 complete. Wire temporarily into main.ts with SceneManager + InputManager + Room for visual verification, then revert. |
| 7 — Enemy | Tasks 1–6 complete. Wire temporarily with Player for visual verification, then revert. |
| 8 — SpellDefinitions | Tasks 1–7 complete. Pure data file, no tests needed. |
| 9 — CollisionUtils | Tasks 1–8 complete. Pure functions, full unit tests. No Three.js in this file. |
| 10 — Projectile | Tasks 1–9 complete. Uses `FIREBALL_RADIUS` from constants and `isOutOfBounds` from CollisionUtils. |
| 11 — SpellCaster | Tasks 1–10 complete. Full unit tests using a mock scene (`{ add: () => {}, remove: () => {} } as unknown as THREE.Scene`). |
| 12 — HUD | Tasks 1–11 complete. Queries DOM elements defined in `index.html` — do not create new DOM structure, only query existing IDs: `hp-fill`, `mana-fill`, `q-cooldown`. |
| 13 — Game | Tasks 1–12 complete. This is the integration task — wires all files together. No new logic, only orchestration. Uses `ENEMY_HALF_X` and `ENEMY_HALF_Z` from constants for collision. |
| 14 — Entry + Smoke | Tasks 1–13 complete. Replace `src/main.ts` stub, run `npm test`, start dev server, verify all 9 success criteria. |

**Step B — After implementer reports DONE, dispatch spec reviewer**

```
Agent(general-purpose):
  description: "Spec review Task N: [task name]"
  prompt: |
    You are reviewing whether an implementation matches its specification.
    Working directory: /Users/omni/repos/arcanum

    ## What Was Requested
    [paste full task text from this plan]

    ## What the Implementer Claims They Built
    [paste implementer's report]

    ## CRITICAL: Do Not Trust the Report
    Read the actual code. Compare implementation to requirements line by line.
    Check for missing pieces and extra features.

    Report:
    - ✅ Spec compliant — if everything matches after code inspection
    - ❌ Issues: [list specifically what's missing or extra, with file:line references]
```

If spec reviewer finds issues: dispatch implementer again with specific fixes, then re-review.

**Step C — After spec review passes, dispatch code quality reviewer**

```
Agent(superpowers:code-reviewer):
  WHAT_WAS_IMPLEMENTED: [from implementer report]
  PLAN_OR_REQUIREMENTS: Task N from docs/superpowers/plans/2026-04-18-arcanum-phase1.md
  BASE_SHA: [commit SHA before this task]
  HEAD_SHA: [current HEAD SHA]
  DESCRIPTION: [task name and one-line summary]
```

Get SHAs with: `git log --oneline -5`

If quality reviewer finds issues: dispatch implementer to fix, then re-review.

**Step D — Mark task complete in TodoWrite, move to next task.**

### Model Selection

| Task | Model |
|---|---|
| 1 — Scaffold | `haiku` — mechanical CLI commands |
| 2 — Constants | `haiku` — pure data entry |
| 3 — InputManager | `haiku` — isolated logic + tests |
| 4 — SceneManager | `sonnet` — Three.js setup with visual check |
| 5 — Room | `sonnet` — Three.js geometry |
| 6 — Player | `sonnet` — Three.js + movement logic |
| 7 — Enemy | `haiku` — simple AI, similar to Player |
| 8 — SpellDefinitions | `haiku` — pure data |
| 9 — CollisionUtils | `haiku` — pure math + tests |
| 10 — Projectile | `haiku` — similar to Enemy |
| 11 — SpellCaster | `sonnet` — integration logic + tests |
| 12 — HUD | `haiku` — DOM manipulation only |
| 13 — Game | `sonnet` — integration, orchestration |
| 14 — Entry + Smoke | `sonnet` — verification across all criteria |
| Spec reviewers | `sonnet` |
| Quality reviewers | `opus` (default code-reviewer) |

### After All 14 Tasks

Invoke `Skill("superpowers:finishing-a-development-branch")` to complete the branch.

---

## File Map

| File | Responsibility |
|---|---|
| `index.html` | Single HTML entry, HUD scaffold, canvas mount point |
| `styles.css` | All styles — no inline CSS anywhere |
| `src/main.ts` | Instantiates Game, calls `game.start()` |
| `src/constants.ts` | All magic numbers |
| `src/core/Game.ts` | Loop orchestration only — no logic implementation |
| `src/core/InputManager.ts` | Keyboard held/justPressed/justReleased state |
| `src/core/SceneManager.ts` | Renderer, ortho camera, lights, resize handler |
| `src/dungeon/Room.ts` | Hardcoded room geometry, exposes `RoomBounds` |
| `src/entities/Player.ts` | Position, HP, mana, mesh, movement, mana regen |
| `src/entities/Enemy.ts` | Position, HP, mesh, walk-toward-player AI, death |
| `src/entities/Projectile.ts` | Mesh, velocity, range checking, self-destroy |
| `src/spells/SpellDefinitions.ts` | Pure data — Fireball spell object + `Spell` interface |
| `src/spells/SpellCaster.ts` | `cast()`, cooldown ticking, mana deduction |
| `src/utils/CollisionUtils.ts` | `circleVsRect()`, `isOutOfBounds()` — pure functions |
| `src/ui/HUD.ts` | Queries DOM elements, updates bars + cooldown overlay |
| `tests/InputManager.test.ts` | Unit tests for held/justPressed logic |
| `tests/CollisionUtils.test.ts` | Unit tests for AABB math |
| `tests/SpellCaster.test.ts` | Unit tests for cooldown, mana deduction |

---

## Task 1: Scaffold the Project

**Files:**
- Create: `package.json` (via Vite CLI)
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `styles.css`
- Create: `src/main.ts`

- [ ] **Step 1: Initialize Vite + TypeScript project**

```bash
cd /Users/omni/repos/arcanum
npm create vite@latest . -- --template vanilla-ts
```

When prompted "Current directory is not empty. Remove existing files and continue?" — choose **yes** (only the spec docs exist).

- [ ] **Step 2: Install dependencies**

```bash
npm install three
npm install -D vitest @vitest/ui jsdom
```

- [ ] **Step 3: Replace `vite.config.ts`**

Create/replace `vite.config.ts` at the project root:

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
  },
})
```

- [ ] **Step 4: Update `tsconfig.json`**

Replace the generated `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 5: Add test script to `package.json`**

Add `"test": "vitest run"` and `"test:watch": "vitest"` to the `scripts` section of the generated `package.json`.

- [ ] **Step 6: Delete Vite template boilerplate**

```bash
rm -f src/counter.ts src/typescript.svg public/vite.svg src/style.css
```

- [ ] **Step 7: Write `index.html`**

Replace the generated `index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Arcanum</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div id="game-canvas"></div>

    <div id="hud">
      <div id="hud-topleft">
        <div class="stat-bar-wrap">
          <span class="bar-label">HP</span>
          <div class="bar-track">
            <div id="hp-fill" class="bar-fill hp"></div>
          </div>
        </div>
        <div class="stat-bar-wrap">
          <span class="bar-label">MP</span>
          <div class="bar-track">
            <div id="mana-fill" class="bar-fill mana"></div>
          </div>
        </div>
      </div>

      <div id="spell-bar">
        <div class="spell-slot fire" id="slot-q">
          <div class="slot-key">Q</div>
          <div class="slot-name">Fireball</div>
          <div class="slot-mana">20 MP</div>
          <div class="cooldown-overlay" id="q-cooldown"></div>
        </div>
        <div class="spell-slot inactive">
          <div class="slot-key">W</div>
        </div>
        <div class="spell-slot inactive">
          <div class="slot-key">E</div>
        </div>
        <div class="spell-slot inactive">
          <div class="slot-key">R</div>
        </div>
      </div>
    </div>

    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 8: Write `styles.css`**

Create `styles.css` at the project root:

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: #000;
  overflow: hidden;
  font-family: 'Courier New', monospace;
}

#game-canvas {
  position: fixed;
  inset: 0;
}

#game-canvas canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

#hud {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10;
}

#hud-topleft {
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-bar-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bar-label {
  color: #ccc;
  font-size: 12px;
  width: 20px;
}

.bar-track {
  width: 160px;
  height: 12px;
  background: #333;
  border-radius: 2px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.1s linear;
}

.bar-fill.hp   { background: #c0392b; }
.bar-fill.mana { background: #2980b9; }

#spell-bar {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
}

.spell-slot {
  position: relative;
  width: 72px;
  height: 80px;
  border: 2px solid #555;
  border-radius: 4px;
  background: #111;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  overflow: hidden;
}

.spell-slot.fire     { border-color: #ff6600; }
.spell-slot.inactive { opacity: 0.4; }

.slot-key  { color: #fff;    font-size: 18px; font-weight: bold; }
.slot-name { color: #ffaa66; font-size: 10px; text-align: center; }
.slot-mana { color: #66aaff; font-size: 9px; }

.cooldown-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 0;
  background: rgba(0, 0, 0, 0.7);
  transition: height 0.05s linear;
}
```

- [ ] **Step 9: Write stub `src/main.ts`**

```typescript
// Entry point — wired up in Task 14
console.log('Arcanum loading...')
```

- [ ] **Step 10: Create the tests directory**

```bash
mkdir -p tests
```

- [ ] **Step 11: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite prints a local URL (e.g. `http://localhost:5173`). Open it — browser shows a black screen (no game yet, that's correct).

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + TypeScript + Three.js project"
```

---

## Task 2: Constants

**Files:**
- Create: `src/constants.ts`

- [ ] **Step 1: Write `src/constants.ts`**

```typescript
export const ROOM_WIDTH  = 20
export const ROOM_HEIGHT = 20
export const WALL_THICKNESS = 1
export const WALL_HEIGHT    = 2
export const VIEW_WIDTH  = 30

export const PLAYER_SPEED  = 6
export const PLAYER_RADIUS = 0.4
export const MANA_REGEN_RATE = 5

export const ENEMY_SPEED  = 2
export const ENEMY_WIDTH  = 0.8
export const ENEMY_DEPTH  = 0.8
export const ENEMY_HALF_X = ENEMY_WIDTH / 2
export const ENEMY_HALF_Z = ENEMY_DEPTH / 2

export const FIREBALL_SPEED    = 12
export const FIREBALL_RANGE    = 20
export const FIREBALL_DAMAGE   = 30
export const FIREBALL_MANA_COST = 20
export const FIREBALL_COOLDOWN = 1.5
export const FIREBALL_RADIUS   = 0.2

export const DELTA_CAP = 0.1
```

- [ ] **Step 2: Commit**

```bash
git add src/constants.ts
git commit -m "feat: add game constants"
```

---

## Task 3: InputManager

**Files:**
- Create: `src/core/InputManager.ts`
- Create: `tests/InputManager.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/InputManager.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { InputManager } from '../src/core/InputManager'

describe('InputManager', () => {
  let input: InputManager

  beforeEach(() => {
    input = new InputManager()
  })

  afterEach(() => {
    input.dispose()
  })

  it('reports isHeld true while a key is held down', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true }))
    expect(input.isHeld('ArrowUp')).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp', bubbles: true }))
    expect(input.isHeld('ArrowUp')).toBe(false)
  })

  it('isJustPressed is false before update(), true after, false the next frame', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }))
    expect(input.isJustPressed('KeyQ')).toBe(false) // not yet promoted
    input.update()
    expect(input.isJustPressed('KeyQ')).toBe(true)
    input.update() // second frame
    expect(input.isJustPressed('KeyQ')).toBe(false) // cleared
  })

  it('does not double-register justPressed on key repeat events', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true })) // repeat
    input.update()
    // held should be true, justPressed should have fired exactly once
    expect(input.isHeld('ArrowLeft')).toBe(true)
    expect(input.isJustPressed('ArrowLeft')).toBe(true)
    // can't assert "exactly once" directly, but verifying no crash and truthy is sufficient
  })

  it('reports isJustReleased on the frame after keyup', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }))
    input.update()
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', bubbles: true }))
    input.update()
    expect(input.isJustReleased('KeyQ')).toBe(true)
    input.update()
    expect(input.isJustReleased('KeyQ')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `InputManager` not found.

- [ ] **Step 3: Write `src/core/InputManager.ts`**

```typescript
export class InputManager {
  private held = new Set<string>()
  private pendingPressed  = new Set<string>()
  private pendingReleased = new Set<string>()
  private _justPressed    = new Set<string>()
  private _justReleased   = new Set<string>()

  private onKeyDown = (e: KeyboardEvent): void => {
    // Prevent page scroll on arrow keys and space
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
      e.preventDefault()
    }
    if (!this.held.has(e.code)) {
      this.pendingPressed.add(e.code)
    }
    this.held.add(e.code)
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code)
    this.pendingReleased.add(e.code)
  }

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup',   this.onKeyUp)
  }

  /** Call once at the top of each game loop frame. */
  update(): void {
    this._justPressed  = new Set(this.pendingPressed)
    this._justReleased = new Set(this.pendingReleased)
    this.pendingPressed.clear()
    this.pendingReleased.clear()
  }

  isHeld(code: string):         boolean { return this.held.has(code) }
  isJustPressed(code: string):  boolean { return this._justPressed.has(code) }
  isJustReleased(code: string): boolean { return this._justReleased.has(code) }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup',   this.onKeyUp)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — all 4 InputManager tests green.

- [ ] **Step 5: Commit**

```bash
git add src/core/InputManager.ts tests/InputManager.test.ts
git commit -m "feat: add InputManager with held/justPressed state"
```

---

## Task 4: SceneManager

**Files:**
- Create: `src/core/SceneManager.ts`

No unit tests — verified visually.

- [ ] **Step 1: Write `src/core/SceneManager.ts`**

```typescript
import * as THREE from 'three'
import { VIEW_WIDTH } from '../constants'

export class SceneManager {
  readonly scene    = new THREE.Scene()
  readonly renderer = new THREE.WebGLRenderer({ antialias: true })
  readonly camera:  THREE.OrthographicCamera

  constructor() {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    document.getElementById('game-canvas')!.appendChild(this.renderer.domElement)

    const aspect = window.innerWidth / window.innerHeight
    const hw     = VIEW_WIDTH / 2
    this.camera  = new THREE.OrthographicCamera(
      -hw, hw, hw / aspect, -hw / aspect, 0.1, 200
    )
    // Isometric-style angle: ~55° pitch, 45° yaw — Diablo/Hades feel
    this.camera.position.set(0, 20, 14)
    this.camera.lookAt(0, 0, 0)

    const ambient     = new THREE.AmbientLight(0xffffff, 0.6)
    const directional = new THREE.DirectionalLight(0xfff5e0, 0.8)
    directional.position.set(-10, 20, 10)
    this.scene.add(ambient, directional)

    window.addEventListener('resize', this.onResize)
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  private onResize = (): void => {
    const aspect = window.innerWidth / window.innerHeight
    const hw     = VIEW_WIDTH / 2
    this.camera.left   = -hw
    this.camera.right  =  hw
    this.camera.top    =  hw / aspect
    this.camera.bottom = -hw / aspect
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }
}
```

- [ ] **Step 2: Wire temporarily into `src/main.ts` to verify visually**

Replace `src/main.ts`:

```typescript
import { SceneManager } from './core/SceneManager'

const sm = new SceneManager()
function loop() {
  requestAnimationFrame(loop)
  sm.render()
}
loop()
```

- [ ] **Step 3: Open browser, verify dark scene renders without errors**

Run `npm run dev`, open browser. Expected: black/dark scene, no console errors.

- [ ] **Step 4: Revert main.ts to stub**

```typescript
console.log('Arcanum loading...')
```

- [ ] **Step 5: Commit**

```bash
git add src/core/SceneManager.ts src/main.ts
git commit -m "feat: add SceneManager with isometric ortho camera"
```

---

## Task 5: Room

**Files:**
- Create: `src/dungeon/Room.ts`

No unit tests — verified visually.

- [ ] **Step 1: Write `src/dungeon/Room.ts`**

```typescript
import * as THREE from 'three'
import { ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, WALL_HEIGHT } from '../constants'

export interface RoomBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export class Room {
  /** Interior walkable bounds — wall thickness already subtracted. */
  readonly bounds: RoomBounds = {
    minX: -(ROOM_WIDTH  / 2) + WALL_THICKNESS,
    maxX:  (ROOM_WIDTH  / 2) - WALL_THICKNESS,
    minZ: -(ROOM_HEIGHT / 2) + WALL_THICKNESS,
    maxZ:  (ROOM_HEIGHT / 2) - WALL_THICKNESS,
  }

  build(scene: THREE.Scene): void {
    scene.add(this.buildFloor())
    this.buildWalls().forEach(w => scene.add(w))
  }

  private buildFloor(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT)
    const mat = new THREE.MeshStandardMaterial({ map: this.buildGridTexture() })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    return mesh
  }

  private buildGridTexture(): THREE.CanvasTexture {
    const size   = 512
    const canvas = document.createElement('canvas')
    canvas.width  = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = '#2a2a4e'
    ctx.lineWidth   = 1
    const cells    = 20
    const cellSize = size / cells
    for (let i = 0; i <= cells; i++) {
      ctx.beginPath(); ctx.moveTo(i * cellSize, 0);    ctx.lineTo(i * cellSize, size); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0,    i * cellSize); ctx.lineTo(size, i * cellSize); ctx.stroke()
    }
    return new THREE.CanvasTexture(canvas)
  }

  private buildWalls(): THREE.Mesh[] {
    const mat = new THREE.MeshStandardMaterial({ color: 0x555566 })
    const hw  = ROOM_WIDTH  / 2
    const hh  = ROOM_HEIGHT / 2
    const wt  = WALL_THICKNESS
    const wh  = WALL_HEIGHT / 2

    // Each entry: [boxWidth, boxDepth, posX, posY, posZ]
    const defs: [number, number, number, number, number][] = [
      [ROOM_WIDTH, wt,          0,            wh,  -hh + wt / 2],  // north
      [ROOM_WIDTH, wt,          0,            wh,   hh - wt / 2],  // south
      [wt,         ROOM_HEIGHT, -hw + wt / 2, wh,   0          ],  // west
      [wt,         ROOM_HEIGHT,  hw - wt / 2, wh,   0          ],  // east
    ]

    return defs.map(([w, d, x, y, z]) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_HEIGHT, d), mat)
      mesh.position.set(x, y, z)
      return mesh
    })
  }
}
```

- [ ] **Step 2: Wire temporarily into `src/main.ts` to verify visually**

```typescript
import { SceneManager } from './core/SceneManager'
import { Room }         from './dungeon/Room'

const sm   = new SceneManager()
const room = new Room()
room.build(sm.scene)

function loop() { requestAnimationFrame(loop); sm.render() }
loop()
```

- [ ] **Step 3: Open browser, verify room renders**

Expected: dark tiled floor with 4 grey walls visible from isometric angle. Room should fit comfortably in frame.

- [ ] **Step 4: Revert main.ts to stub**

```typescript
console.log('Arcanum loading...')
```

- [ ] **Step 5: Commit**

```bash
git add src/dungeon/Room.ts src/main.ts
git commit -m "feat: add hardcoded Room with floor grid and walls"
```

---

## Task 6: Player

**Files:**
- Create: `src/entities/Player.ts`

No unit tests — movement verified visually. Mana regen has no testable side effects in isolation.

- [ ] **Step 1: Write `src/entities/Player.ts`**

```typescript
import * as THREE from 'three'
import { PLAYER_SPEED, PLAYER_RADIUS, MANA_REGEN_RATE } from '../constants'
import type { InputManager } from '../core/InputManager'
import type { RoomBounds }   from '../dungeon/Room'

export class Player {
  readonly mesh: THREE.Mesh
  /** Alias for mesh.position — same object reference. */
  readonly position: THREE.Vector3

  hp      = 100
  maxHp   = 100
  mana    = 100
  maxMana = 100

  /** Last non-zero movement direction; used as fallback for spell targeting. */
  lastDirection = new THREE.Vector3(0, 0, 1)

  constructor() {
    const geo  = new THREE.CylinderGeometry(PLAYER_RADIUS, PLAYER_RADIUS, 1.5, 16)
    const mat  = new THREE.MeshStandardMaterial({ color: 0xffffff })
    this.mesh  = new THREE.Mesh(geo, mat)
    this.mesh.position.set(0, 0.75, 0)
    this.position = this.mesh.position
  }

  update(delta: number, input: InputManager, bounds: RoomBounds): void {
    const dir = new THREE.Vector3()
    if (input.isHeld('ArrowLeft'))  dir.x -= 1
    if (input.isHeld('ArrowRight')) dir.x += 1
    if (input.isHeld('ArrowUp'))    dir.z -= 1
    if (input.isHeld('ArrowDown'))  dir.z += 1

    if (dir.lengthSq() > 0) {
      dir.normalize()
      this.lastDirection.copy(dir)
      this.position.x += dir.x * PLAYER_SPEED * delta
      this.position.z += dir.z * PLAYER_SPEED * delta
    }

    // Clamp to interior room bounds
    this.position.x = Math.max(bounds.minX + PLAYER_RADIUS, Math.min(bounds.maxX - PLAYER_RADIUS, this.position.x))
    this.position.z = Math.max(bounds.minZ + PLAYER_RADIUS, Math.min(bounds.maxZ - PLAYER_RADIUS, this.position.z))

    this.mana = Math.min(this.maxMana, this.mana + MANA_REGEN_RATE * delta)
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount)
  }
}
```

- [ ] **Step 2: Wire temporarily into `src/main.ts` to verify visually**

```typescript
import * as THREE from 'three'
import { SceneManager } from './core/SceneManager'
import { InputManager } from './core/InputManager'
import { Room }         from './dungeon/Room'
import { Player }       from './entities/Player'

const sm    = new SceneManager()
const input = new InputManager()
const room  = new Room()
const player = new Player()

room.build(sm.scene)
sm.scene.add(player.mesh)

const clock = new THREE.Clock()
function loop() {
  requestAnimationFrame(loop)
  const delta = Math.min(clock.getDelta(), 0.1)
  input.update()
  player.update(delta, input, room.bounds)
  sm.render()
}
loop()
```

- [ ] **Step 3: Open browser, verify player moves with arrow keys and cannot leave room**

Expected: white cylinder moves smoothly, stops at walls, diagonals work.

- [ ] **Step 4: Revert main.ts to stub**

```typescript
console.log('Arcanum loading...')
```

- [ ] **Step 5: Commit**

```bash
git add src/entities/Player.ts src/main.ts
git commit -m "feat: add Player with arrow-key movement and room clamping"
```

---

## Task 7: Enemy

**Files:**
- Create: `src/entities/Enemy.ts`

- [ ] **Step 1: Write `src/entities/Enemy.ts`**

```typescript
import * as THREE from 'three'
import { ENEMY_SPEED } from '../constants'

export class Enemy {
  readonly mesh: THREE.Mesh
  /** Alias for mesh.position — same object reference. */
  readonly position: THREE.Vector3

  hp:    number
  maxHp: number
  alive = true

  constructor(x: number, z: number, hp = 40) {
    this.hp    = hp
    this.maxHp = hp

    const geo  = new THREE.BoxGeometry(0.8, 1.2, 0.8)
    const mat  = new THREE.MeshStandardMaterial({ color: 0xff2222 })
    this.mesh  = new THREE.Mesh(geo, mat)
    this.mesh.position.set(x, 0.6, z)
    this.position = this.mesh.position
  }

  update(delta: number, playerPosition: THREE.Vector3): void {
    if (!this.alive) return

    const dir  = new THREE.Vector3().subVectors(playerPosition, this.position).setY(0)
    const dist = dir.length()
    // Stop jittering when very close to player
    if (dist > 0.5) {
      dir.normalize()
      this.position.x += dir.x * ENEMY_SPEED * delta
      this.position.z += dir.z * ENEMY_SPEED * delta
    }
  }

  takeDamage(amount: number, scene: THREE.Scene): void {
    this.hp -= amount
    if (this.hp <= 0) this.die(scene)
  }

  private die(scene: THREE.Scene): void {
    this.alive = false
    scene.remove(this.mesh)
  }
}
```

- [ ] **Step 2: Wire temporarily into `src/main.ts` to verify visually**

```typescript
import * as THREE from 'three'
import { SceneManager } from './core/SceneManager'
import { InputManager } from './core/InputManager'
import { Room }         from './dungeon/Room'
import { Player }       from './entities/Player'
import { Enemy }        from './entities/Enemy'

const sm     = new SceneManager()
const input  = new InputManager()
const room   = new Room()
const player = new Player()
const enemy  = new Enemy(5, 5)

room.build(sm.scene)
sm.scene.add(player.mesh, enemy.mesh)

const clock = new THREE.Clock()
function loop() {
  requestAnimationFrame(loop)
  const delta = Math.min(clock.getDelta(), 0.1)
  input.update()
  player.update(delta, input, room.bounds)
  enemy.update(delta, player.position)
  sm.render()
}
loop()
```

- [ ] **Step 3: Open browser, verify enemy walks toward player**

Expected: red box starts at (5,5) and continuously moves toward the white cylinder.

- [ ] **Step 4: Revert main.ts to stub**

```typescript
console.log('Arcanum loading...')
```

- [ ] **Step 5: Commit**

```bash
git add src/entities/Enemy.ts src/main.ts
git commit -m "feat: add Enemy with walk-toward-player AI"
```

---

## Task 8: SpellDefinitions

**Files:**
- Create: `src/spells/SpellDefinitions.ts`

Pure data — no tests needed.

- [ ] **Step 1: Write `src/spells/SpellDefinitions.ts`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/spells/SpellDefinitions.ts
git commit -m "feat: add SpellDefinitions with Fireball"
```

---

## Task 9: CollisionUtils

**Files:**
- Create: `src/utils/CollisionUtils.ts`
- Create: `tests/CollisionUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/CollisionUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { circleVsRect, isOutOfBounds } from '../src/utils/CollisionUtils'
import type { RoomBounds } from '../src/dungeon/Room'

describe('circleVsRect', () => {
  it('returns true when circle center is inside rect', () => {
    expect(circleVsRect(0, 0, 0.5, -1, 1, -1, 1)).toBe(true)
  })

  it('returns true when circle edge exactly touches rect edge', () => {
    // circle center at (1.5, 0), radius 0.5 — right edge at x=1.5, touching rect maxX=1
    expect(circleVsRect(1.5, 0, 0.5, -1, 1, -1, 1)).toBe(true)
  })

  it('returns false when circle is outside and not touching', () => {
    expect(circleVsRect(3, 0, 0.5, -1, 1, -1, 1)).toBe(false)
  })

  it('returns true when circle overlaps corner of rect', () => {
    // nearest point on rect to (1.3, 1.3) is (1, 1); distance = sqrt(0.18) ≈ 0.424 < 0.5
    expect(circleVsRect(1.3, 1.3, 0.5, -1, 1, -1, 1)).toBe(true)
  })

  it('returns false when circle misses corner of rect', () => {
    // nearest point on rect to (1.5, 1.5) is (1, 1); distance = sqrt(0.5) ≈ 0.707 > 0.5
    expect(circleVsRect(1.5, 1.5, 0.5, -1, 1, -1, 1)).toBe(false)
  })
})

describe('isOutOfBounds', () => {
  const bounds: RoomBounds = { minX: -9, maxX: 9, minZ: -9, maxZ: 9 }

  it('returns false for a point inside bounds', () => {
    expect(isOutOfBounds(0, 0, bounds)).toBe(false)
  })

  it('returns true for a point past maxX', () => {
    expect(isOutOfBounds(10, 0, bounds)).toBe(true)
  })

  it('returns true for a point past minZ', () => {
    expect(isOutOfBounds(0, -10, bounds)).toBe(true)
  })

  it('returns false on the exact boundary', () => {
    expect(isOutOfBounds(9, 9, bounds)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `CollisionUtils` not found.

- [ ] **Step 3: Write `src/utils/CollisionUtils.ts`**

```typescript
import type { RoomBounds } from '../dungeon/Room'

/**
 * Circle-vs-AABB in XZ plane.
 * Finds the nearest point on the rect to the circle center,
 * then checks if that distance is within the radius.
 */
export function circleVsRect(
  cx: number, cz: number, radius: number,
  minX: number, maxX: number, minZ: number, maxZ: number
): boolean {
  const nearestX = Math.max(minX, Math.min(cx, maxX))
  const nearestZ = Math.max(minZ, Math.min(cz, maxZ))
  const dx = cx - nearestX
  const dz = cz - nearestZ
  return dx * dx + dz * dz <= radius * radius
}

/** Returns true if (px, pz) lies outside the room bounds. */
export function isOutOfBounds(px: number, pz: number, bounds: RoomBounds): boolean {
  return px < bounds.minX || px > bounds.maxX || pz < bounds.minZ || pz > bounds.maxZ
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — all 9 CollisionUtils tests (+ existing InputManager tests) green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/CollisionUtils.ts tests/CollisionUtils.test.ts
git commit -m "feat: add CollisionUtils with circleVsRect and isOutOfBounds"
```

---

## Task 10: Projectile

**Files:**
- Create: `src/entities/Projectile.ts`

No unit tests — mesh creation and movement verified visually via SpellCaster integration.

- [ ] **Step 1: Write `src/entities/Projectile.ts`**

```typescript
import * as THREE from 'three'
import { FIREBALL_RADIUS } from '../constants'
import type { RoomBounds } from '../dungeon/Room'
import { isOutOfBounds }   from '../utils/CollisionUtils'

export class Projectile {
  readonly mesh:     THREE.Mesh
  readonly velocity: THREE.Vector3
  readonly origin:   THREE.Vector3
  readonly range:    number
  readonly damage:   number
  alive = true

  constructor(
    origin:    THREE.Vector3,
    direction: THREE.Vector3,
    speed:     number,
    range:     number,
    damage:    number,
  ) {
    this.origin   = origin.clone()
    this.range    = range
    this.damage   = damage
    this.velocity = direction.clone().normalize().multiplyScalar(speed)

    const geo  = new THREE.SphereGeometry(FIREBALL_RADIUS, 8, 8)
    const mat  = new THREE.MeshStandardMaterial({
      color:             0xff4400,
      emissive:          new THREE.Color(0xff4400),
      emissiveIntensity: 1,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.copy(origin)
  }

  update(delta: number, bounds: RoomBounds, scene: THREE.Scene): void {
    if (!this.alive) return

    this.mesh.position.x += this.velocity.x * delta
    this.mesh.position.z += this.velocity.z * delta

    const travelled = this.mesh.position.distanceTo(this.origin)
    if (travelled > this.range || isOutOfBounds(this.mesh.position.x, this.mesh.position.z, bounds)) {
      this.destroy(scene)
    }
  }

  destroy(scene: THREE.Scene): void {
    if (!this.alive) return
    this.alive = false
    scene.remove(this.mesh)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/entities/Projectile.ts
git commit -m "feat: add Projectile entity with velocity and range expiry"
```

---

## Task 11: SpellCaster

**Files:**
- Create: `src/spells/SpellCaster.ts`
- Create: `tests/SpellCaster.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/SpellCaster.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import * as THREE from 'three'
import { SpellCaster } from '../src/spells/SpellCaster'

// Minimal scene mock — Three.js Mesh/Geometry don't need WebGL to construct
const mockScene = { add: () => {}, remove: () => {} } as unknown as THREE.Scene

describe('SpellCaster', () => {
  let caster:     SpellCaster
  let manaSource: { mana: number }

  beforeEach(() => {
    manaSource = { mana: 100 }
    caster     = new SpellCaster(manaSource)
  })

  it('casts fireball, returns a Projectile, and deducts mana', () => {
    const proj = caster.cast('fireball', new THREE.Vector3(), new THREE.Vector3(1, 0, 0), mockScene)
    expect(proj).not.toBeNull()
    expect(manaSource.mana).toBe(80) // 100 - 20
  })

  it('returns null on the second cast while still on cooldown', () => {
    const origin = new THREE.Vector3()
    const dir    = new THREE.Vector3(1, 0, 0)
    caster.cast('fireball', origin, dir, mockScene)
    const second = caster.cast('fireball', origin, dir, mockScene)
    expect(second).toBeNull()
  })

  it('returns null when mana is insufficient', () => {
    manaSource.mana = 10 // fireball costs 20
    const proj = caster.cast('fireball', new THREE.Vector3(), new THREE.Vector3(1, 0, 0), mockScene)
    expect(proj).toBeNull()
    expect(manaSource.mana).toBe(10) // unchanged
  })

  it('becomes ready after the full cooldown elapses', () => {
    caster.cast('fireball', new THREE.Vector3(), new THREE.Vector3(1, 0, 0), mockScene)
    expect(caster.isReady('fireball')).toBe(false)
    caster.update(1.5) // cooldown = 1.5 s
    expect(caster.isReady('fireball')).toBe(true)
  })

  it('getCooldownRatio is 1 right after cast and 0 when ready', () => {
    caster.cast('fireball', new THREE.Vector3(), new THREE.Vector3(1, 0, 0), mockScene)
    expect(caster.getCooldownRatio('fireball')).toBeCloseTo(1)
    caster.update(1.5)
    expect(caster.getCooldownRatio('fireball')).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `SpellCaster` not found.

- [ ] **Step 3: Write `src/spells/SpellCaster.ts`**

```typescript
import * as THREE from 'three'
import { SPELLS }     from './SpellDefinitions'
import { Projectile } from '../entities/Projectile'

export class SpellCaster {
  private cooldowns = new Map<string, number>()   // spellId → seconds remaining
  private manaSrc:  { mana: number }

  constructor(manaSrc: { mana: number }) {
    this.manaSrc = manaSrc
  }

  /** Tick all active cooldowns down by delta seconds. */
  update(delta: number): void {
    for (const [id, remaining] of this.cooldowns) {
      this.cooldowns.set(id, Math.max(0, remaining - delta))
    }
  }

  cast(
    spellId:   string,
    origin:    THREE.Vector3,
    direction: THREE.Vector3,
    scene:     THREE.Scene,
  ): Projectile | null {
    const spell = SPELLS[spellId]
    if (!spell || spell.type !== 'projectile' || spell.speed === undefined) return null
    if ((this.cooldowns.get(spellId) ?? 0) > 0) return null
    if (this.manaSrc.mana < spell.manaCost) return null

    this.manaSrc.mana -= spell.manaCost
    this.cooldowns.set(spellId, spell.cooldown)

    const proj = new Projectile(origin, direction, spell.speed, spell.range, spell.damage)
    scene.add(proj.mesh)
    return proj
  }

  /** 0 = ready to cast, 1 = just cast (full cooldown remaining). */
  getCooldownRatio(spellId: string): number {
    const spell     = SPELLS[spellId]
    if (!spell) return 0
    const remaining = this.cooldowns.get(spellId) ?? 0
    return remaining / spell.cooldown
  }

  isReady(spellId: string): boolean {
    return (this.cooldowns.get(spellId) ?? 0) <= 0
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — all tests (InputManager + CollisionUtils + SpellCaster) green.

- [ ] **Step 5: Commit**

```bash
git add src/spells/SpellCaster.ts tests/SpellCaster.test.ts
git commit -m "feat: add SpellCaster with cooldown and mana management"
```

---

## Task 12: HUD

**Files:**
- Create: `src/ui/HUD.ts`

No unit tests — visual verification.

- [ ] **Step 1: Write `src/ui/HUD.ts`**

```typescript
import type { Player }      from '../entities/Player'
import type { SpellCaster } from '../spells/SpellCaster'

export class HUD {
  private hpFill!:       HTMLElement
  private manaFill!:     HTMLElement
  private qCooldown!:    HTMLElement

  init(): void {
    this.hpFill    = document.getElementById('hp-fill')!
    this.manaFill  = document.getElementById('mana-fill')!
    this.qCooldown = document.getElementById('q-cooldown')!
  }

  update(player: Player, caster: SpellCaster): void {
    this.hpFill.style.width    = `${(player.hp   / player.maxHp)   * 100}%`
    this.manaFill.style.width  = `${(player.mana / player.maxMana) * 100}%`
    this.qCooldown.style.height = `${caster.getCooldownRatio('fireball') * 100}%`
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/HUD.ts
git commit -m "feat: add HUD — HP bar, mana bar, Q slot cooldown overlay"
```

---

## Task 13: Game Loop Wiring

**Files:**
- Create: `src/core/Game.ts`

- [ ] **Step 1: Write `src/core/Game.ts`**

```typescript
import * as THREE   from 'three'
import { SceneManager } from './SceneManager'
import { InputManager } from './InputManager'
import { Room }         from '../dungeon/Room'
import { Player }       from '../entities/Player'
import { Enemy }        from '../entities/Enemy'
import { Projectile }   from '../entities/Projectile'
import { SpellCaster }  from '../spells/SpellCaster'
import { HUD }          from '../ui/HUD'
import { circleVsRect } from '../utils/CollisionUtils'
import { DELTA_CAP, ENEMY_HALF_X, ENEMY_HALF_Z } from '../constants'

export class Game {
  private sceneManager: SceneManager
  private inputManager: InputManager
  private room:         Room
  private player:       Player
  private enemies:      Enemy[]
  private spellCaster:  SpellCaster
  private hud:          HUD
  private projectiles:  Projectile[] = []
  private clock = new THREE.Clock()

  constructor() {
    this.sceneManager = new SceneManager()
    this.inputManager = new InputManager()
    this.room         = new Room()
    this.player       = new Player()
    this.enemies      = [new Enemy(5, 5)]
    this.spellCaster  = new SpellCaster(this.player)
    this.hud          = new HUD()
  }

  start(): void {
    this.room.build(this.sceneManager.scene)
    this.sceneManager.scene.add(this.player.mesh)
    for (const enemy of this.enemies) {
      this.sceneManager.scene.add(enemy.mesh)
    }
    this.hud.init()
    this.clock.start()
    requestAnimationFrame(this.loop)
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop)
    const delta = Math.min(this.clock.getDelta(), DELTA_CAP)

    this.inputManager.update()
    this.player.update(delta, this.inputManager, this.room.bounds)
    this.spellCaster.update(delta)

    if (this.inputManager.isJustPressed('KeyQ')) {
      this.castFireball()
    }

    for (const enemy of this.enemies) {
      enemy.update(delta, this.player.position)
    }

    for (const proj of this.projectiles) {
      proj.update(delta, this.room.bounds, this.sceneManager.scene)
    }

    this.checkProjectileCollisions()
    this.projectiles = this.projectiles.filter(p => p.alive)

    this.hud.update(this.player, this.spellCaster)
    this.sceneManager.render()
  }

  private castFireball(): void {
    const living = this.enemies.filter(e => e.alive)
    const dir    = this.getDirectionToNearest(living)
    const origin = this.player.position.clone().setY(0.75)
    const proj   = this.spellCaster.cast('fireball', origin, dir, this.sceneManager.scene)
    if (proj) this.projectiles.push(proj)
  }

  private getDirectionToNearest(enemies: Enemy[]): THREE.Vector3 {
    if (enemies.length === 0) return this.player.lastDirection.clone()

    let nearest = enemies[0]
    let minDist = this.player.position.distanceTo(nearest.position)
    for (let i = 1; i < enemies.length; i++) {
      const d = this.player.position.distanceTo(enemies[i].position)
      if (d < minDist) { minDist = d; nearest = enemies[i] }
    }
    return new THREE.Vector3()
      .subVectors(nearest.position, this.player.position)
      .setY(0)
      .normalize()
  }

  private checkProjectileCollisions(): void {
    for (const proj of this.projectiles) {
      if (!proj.alive) continue
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue
        const hit = circleVsRect(
          proj.mesh.position.x, proj.mesh.position.z,
          proj.damage > 0 ? 0.2 : 0,   // projectile radius (FIREBALL_RADIUS)
          enemy.position.x - ENEMY_HALF_X,
          enemy.position.x + ENEMY_HALF_X,
          enemy.position.z - ENEMY_HALF_Z,
          enemy.position.z + ENEMY_HALF_Z,
        )
        if (hit) {
          enemy.takeDamage(proj.damage, this.sceneManager.scene)
          proj.destroy(this.sceneManager.scene)
          break // one projectile hits one enemy
        }
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/Game.ts
git commit -m "feat: add Game loop wiring all systems together"
```

---

## Task 14: Entry Point + Smoke Test

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Write final `src/main.ts`**

```typescript
import { Game } from './core/Game'

const game = new Game()
game.start()
```

- [ ] **Step 2: Run all tests one final time**

```bash
npm test
```

Expected: All tests pass (InputManager × 4, CollisionUtils × 9, SpellCaster × 5).

- [ ] **Step 3: Run the dev server**

```bash
npm run dev
```

Open browser at the printed URL. Verify all 9 Phase 1 success criteria:

- [ ] **Criterion 1:** Game renders — isometric room with dark tiled floor and grey walls visible
- [ ] **Criterion 2:** White cylinder (player) appears in center of room
- [ ] **Criterion 3:** Arrow keys move the player; player cannot walk through walls
- [ ] **Criterion 4:** Red box (enemy) starts at far side of room and walks toward player
- [ ] **Criterion 5:** Pressing Q fires an orange glowing sphere toward the enemy
- [ ] **Criterion 6:** Sphere travels in a straight line and disappears at the room boundary if it misses
- [ ] **Criterion 7:** When the sphere hits the enemy, the enemy takes damage and disappears when HP reaches 0
- [ ] **Criterion 8:** HP and mana bars update in the top-left HUD
- [ ] **Criterion 9:** The Q slot shows a cooldown overlay (dark fill draining downward) after each cast; mana bar decrements on cast and slowly refills

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire main.ts entry point — Phase 1 complete"
```

- [ ] **Step 5: Report**

If all 9 criteria pass: output **"Phase 1 complete"** and stop. Do not proceed to Phase 2 without user confirmation.

---

## Self-Review Notes

- All 9 Phase 1 success criteria map to testable/verifiable steps in Task 14
- `FIREBALL_RADIUS` constant is imported in `Projectile.ts` and used correctly in `Game.ts` collision check — both reference `0.2` via the constant
- `SpellCaster` receives a `{ mana: number }` reference (the Player instance), not a value copy — mana deduction mutates the player's mana directly
- `Room.bounds` strips wall thickness so player clamping and projectile `isOutOfBounds` use the same interior coordinate system
- `Enemy.position` and `Player.position` are aliases to `mesh.position` — mutations in `update()` move the visible mesh automatically
- No barrel files, no circular deps: `CollisionUtils` imports `RoomBounds` from `Room` (type-only, no runtime cycle)
