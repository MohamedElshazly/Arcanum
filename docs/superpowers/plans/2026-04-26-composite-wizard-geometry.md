# Composite Wizard Geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-primitive Player and Enemy meshes with composite "minimalist wizard" models (hat + head + robe + staff) while preserving every existing gameplay-facing API.

**Architecture:** A new `src/visuals/` module exposes pure factories that build `THREE.Group` wizard models from a `WizardModelConfig`. `Player` and `Enemy` switch their `mesh` field from `THREE.Mesh` to `THREE.Group`, route every material mutation through new `setTint(color, intensity)` / `clearTint()` methods, and expose a `dispose(scene)` helper that walks the group and disposes each child's geometry and material. All existing callsites that mutate `mesh.material` or `mesh.geometry` are refactored to the new API. Subtle idle animation (bob/sway) is added in the entity `update` loop.

**Tech Stack:** TypeScript, Three.js (`MeshStandardMaterial`, `Group`, `CylinderGeometry`, `ConeGeometry`, `SphereGeometry`, `TorusGeometry`), Vitest.

---

## File Structure

**New files:**
- `src/visuals/WizardModel.ts` — composite-mesh factory + config types + dispose helper
- `src/visuals/EnemyModelConfig.ts` — per-archetype + per-boss-variant model configs
- `tests/WizardModel.test.ts` — structure/dispose/tint tests

**Modified files:**
- `src/entities/Player.ts` — `mesh: THREE.Group`, new `setTint`/`clearTint`/`disposeModel` API, idle bob in `update()`
- `src/entities/Enemy.ts` — same refactor; `executeBlink` clones via factory; `disposeModel` walks children
- `src/spells/SpellEffects.ts:16-34` — `castBlink` calls `setTint`/`clearTint` instead of touching `mesh.material`
- `src/dungeon/DungeonSession.ts:250-255` — `flashPlayer` calls `setTint`/`clearTint`
- `src/core/Game.ts:151-154` — reset uses `clearTint()` and resets group scale
- `tests/Player.test.ts` — extend with structure assertions

---

## Task 1: WizardModel factory — types and structure

**Files:**
- Create: `src/visuals/WizardModel.ts`
- Test: `tests/WizardModel.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/WizardModel.test.ts
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildWizardModel } from '../src/visuals/WizardModel'

describe('buildWizardModel', () => {
  it('returns a Group with hat, head, robe, staff, orb children', () => {
    const model = buildWizardModel({
      bodyColor: 0x224488,
      accentColor: 0x88ccff,
      hatColor: 0x111133,
      orbColor: 0xaaddff,
      height: 1.5,
      radius: 0.4,
    })

    expect(model.root).toBeInstanceOf(THREE.Group)
    expect(model.body).toBeInstanceOf(THREE.Mesh)
    expect(model.hat).toBeInstanceOf(THREE.Mesh)
    expect(model.head).toBeInstanceOf(THREE.Mesh)
    expect(model.staff).toBeInstanceOf(THREE.Mesh)
    expect(model.orb).toBeInstanceOf(THREE.Mesh)
    // root contains all five parts
    expect(model.root.children.length).toBe(5)
  })

  it('places hat above head above body within total height', () => {
    const model = buildWizardModel({
      bodyColor: 0x224488,
      accentColor: 0x88ccff,
      hatColor: 0x111133,
      orbColor: 0xaaddff,
      height: 1.5,
      radius: 0.4,
    })

    expect(model.hat.position.y).toBeGreaterThan(model.head.position.y)
    expect(model.head.position.y).toBeGreaterThan(model.body.position.y)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/WizardModel.test.ts`
Expected: FAIL — module `'../src/visuals/WizardModel'` not found.

- [ ] **Step 3: Implement the factory**

```ts
// src/visuals/WizardModel.ts
import * as THREE from 'three'

export interface WizardModelConfig {
  /** Robe / body color */
  bodyColor: number
  /** Cuff / trim accent color (also used for staff orb glow ring) */
  accentColor: number
  /** Pointy hat color */
  hatColor: number
  /** Floating staff-tip orb color */
  orbColor: number
  /** Total visual height in world units (hat tip to robe base) */
  height: number
  /** Robe base radius */
  radius: number
  /** Optional emissive intensity for body (default 0.4) */
  emissiveIntensity?: number
}

export interface WizardModel {
  root: THREE.Group
  body: THREE.Mesh   // tapered robe — primary tint target
  head: THREE.Mesh   // small sphere
  hat:  THREE.Mesh   // cone
  staff: THREE.Mesh  // thin cylinder
  orb:  THREE.Mesh   // emissive sphere on staff
}

export function buildWizardModel(cfg: WizardModelConfig): WizardModel {
  const root = new THREE.Group()

  const robeHeight = cfg.height * 0.55
  const headRadius = cfg.radius * 0.55
  const hatHeight  = cfg.height * 0.35
  const hatRadius  = cfg.radius * 0.85

  // Robe: tapered cylinder, narrower at top
  const bodyGeo = new THREE.CylinderGeometry(cfg.radius * 0.65, cfg.radius, robeHeight, 12)
  const bodyMat = new THREE.MeshStandardMaterial({
    color:             new THREE.Color(cfg.bodyColor),
    emissive:          new THREE.Color(cfg.bodyColor),
    emissiveIntensity: cfg.emissiveIntensity ?? 0.4,
  })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.y = robeHeight / 2
  root.add(body)

  // Head: small sphere on top of robe
  const headGeo = new THREE.SphereGeometry(headRadius, 12, 8)
  const headMat = new THREE.MeshStandardMaterial({
    color:    new THREE.Color(cfg.accentColor),
    emissive: new THREE.Color(cfg.accentColor).multiplyScalar(0.2),
  })
  const head = new THREE.Mesh(headGeo, headMat)
  head.position.y = robeHeight + headRadius * 0.6
  root.add(head)

  // Hat: cone above head
  const hatGeo = new THREE.ConeGeometry(hatRadius, hatHeight, 12)
  const hatMat = new THREE.MeshStandardMaterial({
    color:             new THREE.Color(cfg.hatColor),
    emissive:          new THREE.Color(cfg.hatColor),
    emissiveIntensity: 0.3,
  })
  const hat = new THREE.Mesh(hatGeo, hatMat)
  hat.position.y = robeHeight + headRadius * 1.2 + hatHeight / 2
  root.add(hat)

  // Staff: thin cylinder offset to the side
  const staffHeight = cfg.height * 0.95
  const staffGeo = new THREE.CylinderGeometry(0.04, 0.04, staffHeight, 6)
  const staffMat = new THREE.MeshStandardMaterial({
    color:    0x553322,
    emissive: 0x110800,
  })
  const staff = new THREE.Mesh(staffGeo, staffMat)
  staff.position.set(cfg.radius * 0.95, staffHeight / 2 - 0.05, 0)
  root.add(staff)

  // Orb: emissive sphere at staff tip
  const orbGeo = new THREE.SphereGeometry(cfg.radius * 0.25, 10, 6)
  const orbMat = new THREE.MeshStandardMaterial({
    color:             new THREE.Color(cfg.orbColor),
    emissive:          new THREE.Color(cfg.orbColor),
    emissiveIntensity: 1.6,
  })
  const orb = new THREE.Mesh(orbGeo, orbMat)
  orb.position.set(cfg.radius * 0.95, staffHeight + cfg.radius * 0.1, 0)
  root.add(orb)

  return { root, body, head, hat, staff, orb }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/WizardModel.test.ts`
Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add src/visuals/WizardModel.ts tests/WizardModel.test.ts
git commit -m "feat: add composite wizard model factory"
```

---

## Task 2: WizardModel disposal helper

**Files:**
- Modify: `src/visuals/WizardModel.ts`
- Test: `tests/WizardModel.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/WizardModel.test.ts`:

```ts
import { disposeWizardModel } from '../src/visuals/WizardModel'

describe('disposeWizardModel', () => {
  it('disposes geometry and material of every child mesh', () => {
    const model = buildWizardModel({
      bodyColor: 0x224488, accentColor: 0x88ccff, hatColor: 0x111133,
      orbColor: 0xaaddff, height: 1.5, radius: 0.4,
    })

    const geoms = [model.body, model.head, model.hat, model.staff, model.orb]
      .map(m => m.geometry as THREE.BufferGeometry)
    const mats = [model.body, model.head, model.hat, model.staff, model.orb]
      .map(m => m.material as THREE.MeshStandardMaterial)

    const geoSpies = geoms.map(g => vi.spyOn(g, 'dispose'))
    const matSpies = mats.map(m => vi.spyOn(m, 'dispose'))

    disposeWizardModel(model)

    for (const s of geoSpies) expect(s).toHaveBeenCalledOnce()
    for (const s of matSpies) expect(s).toHaveBeenCalledOnce()
  })
})
```

Add `import { vi } from 'vitest'` to the top of the file if not already present.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/WizardModel.test.ts`
Expected: FAIL — `disposeWizardModel` is not exported.

- [ ] **Step 3: Implement disposal**

Append to `src/visuals/WizardModel.ts`:

```ts
export function disposeWizardModel(model: WizardModel): void {
  for (const child of [model.body, model.head, model.hat, model.staff, model.orb]) {
    child.geometry.dispose()
    ;(child.material as THREE.MeshStandardMaterial).dispose()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/WizardModel.test.ts`
Expected: PASS — all three tests green.

- [ ] **Step 5: Commit**

```bash
git add src/visuals/WizardModel.ts tests/WizardModel.test.ts
git commit -m "feat: add disposeWizardModel helper"
```

---

## Task 3: Per-archetype enemy model configs

**Files:**
- Create: `src/visuals/EnemyModelConfig.ts`
- Test: `tests/WizardModel.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/WizardModel.test.ts`:

```ts
import { getEnemyModelConfig } from '../src/visuals/EnemyModelConfig'

describe('getEnemyModelConfig', () => {
  it('returns distinct configs for each archetype', () => {
    const a = getEnemyModelConfig('apprentice', 0xcc4400)
    const b = getEnemyModelConfig('battle_mage', 0xcc4400)
    const w = getEnemyModelConfig('warlock', 0xcc4400)
    expect(a.height).toBeLessThan(b.height)
    expect(w.hatColor).not.toBe(a.hatColor)
  })

  it('returns boss-variant config when variant supplied', () => {
    const cfg = getEnemyModelConfig('boss', 0x000000, 'inferno_titan')
    expect(cfg.height).toBeGreaterThanOrEqual(2.5)
    expect(cfg.bodyColor).toBe(0x441100)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/WizardModel.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the config map**

```ts
// src/visuals/EnemyModelConfig.ts
import type { WizardModelConfig } from './WizardModel'
import type { EnemyArchetype, BossVariant } from '../entities/Enemy'
import { BOSS_VARIANTS } from '../entities/Enemy'

/** Build a WizardModelConfig for an enemy. `dominantColor` is the spell-element tint. */
export function getEnemyModelConfig(
  archetype: EnemyArchetype,
  dominantColor: number,
  bossVariant?: BossVariant,
): WizardModelConfig {
  if (archetype === 'boss') {
    const v = BOSS_VARIANTS[bossVariant ?? 'archlich']
    return {
      bodyColor:         v.meshColor,
      accentColor:       v.emissiveColor,
      hatColor:          v.meshColor,
      orbColor:          v.emissiveColor,
      height:            v.geometry[2],
      radius:            v.geometry[1],
      emissiveIntensity: 1.2,
    }
  }
  if (archetype === 'warlock') {
    return {
      bodyColor:         dominantColor,
      accentColor:       0xeeeeff,
      hatColor:          0x110011,
      orbColor:          dominantColor,
      height:            2.0,
      radius:            0.5,
      emissiveIntensity: 0.9,
    }
  }
  if (archetype === 'battle_mage') {
    return {
      bodyColor:         dominantColor,
      accentColor:       0xcccccc,
      hatColor:          0x222222,
      orbColor:          dominantColor,
      height:            1.8,
      radius:            0.55,
      emissiveIntensity: 0.6,
    }
  }
  // apprentice
  return {
    bodyColor:         dominantColor,
    accentColor:       0xddddee,
    hatColor:          0x333355,
    orbColor:          dominantColor,
    height:            1.4,
    radius:            0.4,
    emissiveIntensity: 0.5,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/WizardModel.test.ts`
Expected: PASS — all five tests green.

- [ ] **Step 5: Commit**

```bash
git add src/visuals/EnemyModelConfig.ts tests/WizardModel.test.ts
git commit -m "feat: add per-archetype enemy model configs"
```

---

## Task 4: Player switches to composite model with setTint API

**Files:**
- Modify: `src/entities/Player.ts`
- Modify: `src/spells/SpellEffects.ts:16-34`
- Modify: `src/dungeon/DungeonSession.ts:250-255`
- Modify: `src/core/Game.ts:151-154`
- Test: `tests/Player.test.ts`

- [ ] **Step 1: Write the failing test**

Replace contents of `tests/Player.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Player } from '../src/entities/Player'
import { MANA_REGEN_RATE } from '../src/constants'

describe('Player mana', () => {
  it('regenerates at 8 MP per second', () => {
    expect(MANA_REGEN_RATE).toBe(8)
  })
})

describe('Player composite model', () => {
  it('exposes a Group as mesh containing 5 child meshes', () => {
    const p = new Player()
    expect(p.mesh).toBeInstanceOf(THREE.Group)
    expect(p.mesh.children.length).toBe(5)
  })

  it('setTint mutates the body emissive; clearTint restores it', () => {
    const p = new Player()
    const body = p.mesh.children.find(c => (c as THREE.Mesh).geometry instanceof THREE.CylinderGeometry) as THREE.Mesh
    const mat  = body.material as THREE.MeshStandardMaterial
    const original = mat.emissive.getHex()

    p.setTint(0x00ff00, 1)
    expect(mat.emissive.getHex()).toBe(0x00ff00)
    p.clearTint()
    expect(mat.emissive.getHex()).toBe(original)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/Player.test.ts`
Expected: FAIL — `p.mesh` is `THREE.Mesh`, not `THREE.Group`; `setTint` undefined.

- [ ] **Step 3: Refactor Player**

Replace the mesh + helper sections of `src/entities/Player.ts`. Specifically:

Replace the field declaration:

```ts
  readonly mesh: THREE.Mesh
```

with:

```ts
  readonly mesh: THREE.Group
  private readonly model: import('../visuals/WizardModel').WizardModel
  private readonly originalBodyEmissive: THREE.Color
  private readonly originalBodyEmissiveIntensity: number
```

Replace the constructor body (lines 53–62):

```ts
  constructor() {
    const { buildWizardModel } = require('../visuals/WizardModel') as typeof import('../visuals/WizardModel')
    this.model = buildWizardModel({
      bodyColor:         0xeeeeff,
      accentColor:       0xffffff,
      hatColor:          0x222244,
      orbColor:          0xaaccff,
      height:            1.5,
      radius:            PLAYER_RADIUS,
      emissiveIntensity: 0.3,
    })
    this.mesh = this.model.root
    this.mesh.position.set(0, 0, 0)
    this.position = this.mesh.position
    const bodyMat = this.model.body.material as THREE.MeshStandardMaterial
    this.originalBodyEmissive = bodyMat.emissive.clone()
    this.originalBodyEmissiveIntensity = bodyMat.emissiveIntensity
  }
```

Note: Replace the `require(...)` with a top-of-file `import` — it is shown inline here so the constructor body diff is self-contained. Add at the top:

```ts
import { buildWizardModel, disposeWizardModel } from '../visuals/WizardModel'
import type { WizardModel } from '../visuals/WizardModel'
```

…and change the `model` field type to `private readonly model: WizardModel`. Remove the `require` from the constructor.

Add new methods at the bottom of the class:

```ts
  setTint(color: number, intensity = 1): void {
    const mat = this.model.body.material as THREE.MeshStandardMaterial
    mat.emissive.setHex(color)
    mat.emissiveIntensity = intensity
  }

  clearTint(): void {
    const mat = this.model.body.material as THREE.MeshStandardMaterial
    mat.emissive.copy(this.originalBodyEmissive)
    mat.emissiveIntensity = this.originalBodyEmissiveIntensity
  }

  setOpacity(opacity: number): void {
    for (const child of [this.model.body, this.model.head, this.model.hat, this.model.staff, this.model.orb]) {
      const m = child.material as THREE.MeshStandardMaterial
      m.transparent = opacity < 1
      m.opacity = opacity
    }
  }

  disposeModel(): void {
    disposeWizardModel(this.model)
  }
```

Now replace every place inside `Player.ts` that previously did `(this.mesh.material as THREE.MeshStandardMaterial)`:

- In the dodge end-block (around line 85-87): replace `mat.opacity = 1; mat.transparent = false` with `this.setOpacity(1)`.
- In `useFlask()` (line 218-219): replace `const mat = ...; mat.emissive.set(0x003300)` with `this.setTint(0x003300, 1)`.
- In the heal-complete block (line 115-116): replace `mat.emissive.set(0x222222)` with `this.clearTint()`.
- In `startDodge()` (line 205-207): replace `mat.transparent = true; mat.opacity = 0.4` with `this.setOpacity(0.4)`.
- In `updateDeath()` (line 275-277): replace material fade with `this.setOpacity(1 - t * 0.8)`.

For the shield mesh that was added as a child of the previous `Mesh`, change `this.mesh.add(this.shieldMesh)` — this still works because `Group.add()` exists. No change needed.

Verify the file compiles: `npx tsc --noEmit`.

- [ ] **Step 4: Update SpellEffects.castBlink**

Replace `src/spells/SpellEffects.ts:16-34` with:

```ts
export function castBlink(
  position:      THREE.Vector3,
  player:        { position: THREE.Vector3; mesh: THREE.Object3D; setTint: (c: number, i?: number) => void; clearTint: () => void },
  lastDirection: THREE.Vector3,
): void {
  position.x += lastDirection.x * 5
  position.z += lastDirection.z * 5
  player.mesh.position.copy(position)

  player.setTint(0xffffff, 1)
  setTimeout(() => player.clearTint(), 100)
}
```

Update the callsite in `src/core/Game.ts:446`:

```ts
        castBlink(this.player.position, this.player, this.player.lastDirection)
```

- [ ] **Step 5: Update DungeonSession.flashPlayer**

Replace `src/dungeon/DungeonSession.ts:250-255` with:

```ts
  private flashPlayer(player: Player): void {
    player.setTint(0x00ff44, 1)
    setTimeout(() => player.clearTint(), 300)
  }
```

- [ ] **Step 6: Update Game.ts reset block**

Replace `src/core/Game.ts:151-154` with:

```ts
    this.player.mesh.scale.set(1, 1, 1)
    this.player.setOpacity(1)
    this.player.clearTint()
```

- [ ] **Step 7: Run tests and typecheck**

Run: `npx tsc --noEmit && npx vitest run tests/Player.test.ts tests/WizardModel.test.ts`
Expected: PASS — typecheck clean, all tests green.

- [ ] **Step 8: Run full test suite**

Run: `npx vitest run`
Expected: PASS — no regressions in the 12 existing test files.

- [ ] **Step 9: Manual visual check**

Run: `npm run dev`
Open the browser, start a run, confirm the player renders as a wizard (hat + head + robe + staff with glowing orb), dodge fades correctly, flask cast tints green, blink flashes white, death animation fades.

- [ ] **Step 10: Commit**

```bash
git add src/entities/Player.ts src/spells/SpellEffects.ts src/dungeon/DungeonSession.ts src/core/Game.ts tests/Player.test.ts
git commit -m "refactor: player uses composite wizard model"
```

---

## Task 5: Enemy switches to composite model

**Files:**
- Modify: `src/entities/Enemy.ts`
- Test: `tests/EnemyScaling.test.ts` (verify no regression)

- [ ] **Step 1: Write a smoke test**

Append to `tests/EnemyScaling.test.ts`:

```ts
import * as THREE from 'three'
import { Enemy } from '../src/entities/Enemy'

describe('Enemy composite model', () => {
  it('apprentice mesh is a Group with 5 child meshes', () => {
    const e = new Enemy({ archetype: 'apprentice', spellIds: ['fireball'], x: 0, z: 0, depth: 1 })
    expect(e.mesh).toBeInstanceOf(THREE.Group)
    expect(e.mesh.children.length).toBeGreaterThanOrEqual(5)
  })

  it('boss mesh is a Group and still has the orbital ring', () => {
    const e = new Enemy({
      archetype: 'boss', spellIds: ['fireball'], x: 0, z: 0,
      depth: 5, bossVariant: 'archlich',
    })
    expect(e.mesh).toBeInstanceOf(THREE.Group)
    // 5 wizard parts + 1 orbital ring
    expect(e.mesh.children.length).toBeGreaterThanOrEqual(6)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/EnemyScaling.test.ts`
Expected: FAIL — Enemy mesh is currently `THREE.Mesh`, not `Group`.

- [ ] **Step 3: Refactor Enemy fields and constructor**

In `src/entities/Enemy.ts`:

Add imports near the top:

```ts
import { buildWizardModel, disposeWizardModel } from '../visuals/WizardModel'
import type { WizardModel } from '../visuals/WizardModel'
import { getEnemyModelConfig } from '../visuals/EnemyModelConfig'
```

Change line 122:

```ts
  readonly mesh:     THREE.Group
```

Add a private field next to `originalEmissive` (line 144):

```ts
  private readonly model: WizardModel
```

Replace the entire `if (config.archetype === 'boss') { ... } else if (config.archetype === 'warlock') { ... } else { ... }` block (lines 180-221) with:

```ts
    const dominantColor = this.dominantColor()
    this.model = buildWizardModel(getEnemyModelConfig(
      config.archetype,
      dominantColor,
      config.bossVariant,
    ))
    this.mesh = this.model.root

    if (config.archetype === 'boss') {
      const vc = variant!
      this.mesh.position.set(config.x, 0, config.z)

      const ringGeo = new THREE.TorusGeometry(1.8, 0.1, 8, 48)
      const ringMat = new THREE.MeshStandardMaterial({
        color:             0xaa44ff,
        emissive:          new THREE.Color(0x6600aa),
        emissiveIntensity: 2,
      })
      this.orbitalRing = new THREE.Mesh(ringGeo, ringMat)
      this.orbitalRing.position.y = vc.geometry[2] / 2
      this.mesh.add(this.orbitalRing)
    } else {
      this.mesh.position.set(config.x, 0, config.z)
    }
```

Note: the model already places parts above y=0 internally, so the group's position is the ground point — different from the previous mesh which was placed at half-height. This means the previous `0.6` / `0.9` / `1.0` / `vc.geometry[2]/2` y-values become just `0`. The orbital ring previously sat at the local origin of the boss cylinder (its center); to keep it at the boss's vertical mid-point, position it at `y = vc.geometry[2] / 2`.

Replace `this.originalEmissive = (this.mesh.material as ...).emissive.clone()` (line 223) with:

```ts
    this.originalEmissive = (this.model.body.material as THREE.MeshStandardMaterial).emissive.clone()
```

- [ ] **Step 4: Update Enemy emissive tint paths**

Replace lines 374-380 (the visual-feedback block):

```ts
    const bodyMat = this.model.body.material as THREE.MeshStandardMaterial

    if (isFrozen)            bodyMat.emissive.setHex(0x00ccff)
    else if (hasBurning)     bodyMat.emissive.setHex(0xff6600)
    else if (isStunned)      bodyMat.emissive.setHex(0xffffff)
    else if (hasSlow)        bodyMat.emissive.setHex(0x4444ff)
    else                     bodyMat.emissive.copy(this.originalEmissive)
```

(Replaces `mat` with `bodyMat`; remove the now-unused `const mat = this.mesh.material as ...` line above it.)

- [ ] **Step 5: Update Enemy death animation**

Replace lines 290-315 (`if (this.dying)` block):

```ts
    if (this.dying) {
      this.dyingTimer += delta
      const t = Math.min(this.dyingTimer / 0.4, 1)
      const s = 1 - t
      this.mesh.scale.set(s, s, s)
      for (const child of [this.model.body, this.model.head, this.model.hat, this.model.staff, this.model.orb]) {
        const cm = child.material as THREE.MeshStandardMaterial
        cm.transparent = true
        cm.opacity     = 1 - t
      }
      if (this.dyingTimer >= 0.4) {
        this.alive = false
        scene.remove(this.mesh)
        disposeWizardModel(this.model)
        if (this.orbitalRing) {
          this.orbitalRing.geometry.dispose()
          ;(this.orbitalRing.material as THREE.MeshStandardMaterial).dispose()
        }
        if (this.ghostMesh) {
          scene.remove(this.ghostMesh)
          this.ghostMesh.geometry.dispose()
          ;(this.ghostMesh.material as THREE.MeshStandardMaterial).dispose()
          this.ghostMesh = null
        }
      }
      return []
    }
```

- [ ] **Step 6: Update Enemy.dispose()**

Replace lines 258-276 (`dispose(scene)` body):

```ts
  dispose(scene: THREE.Scene): void {
    if (!this.alive && !this.dying) return
    this.alive  = false
    this.dying  = false
    this.clearTelegraph(scene)
    scene.remove(this.mesh)
    disposeWizardModel(this.model)
    if (this.orbitalRing) {
      this.orbitalRing.geometry.dispose()
      ;(this.orbitalRing.material as THREE.MeshStandardMaterial).dispose()
    }
    if (this.ghostMesh) {
      scene.remove(this.ghostMesh)
      this.ghostMesh.geometry.dispose()
      ;(this.ghostMesh.material as THREE.MeshStandardMaterial).dispose()
      this.ghostMesh = null
    }
  }
```

- [ ] **Step 7: Update Enemy.executeBlink — clone the body geometry only**

Replace lines 648-661 (`executeBlink`):

```ts
  private executeBlink(dest: THREE.Vector3, scene: THREE.Scene): void {
    const ghostGeo = this.model.body.geometry.clone()
    const bodyMat  = this.model.body.material as THREE.MeshStandardMaterial
    const ghostMat = new THREE.MeshStandardMaterial({
      color:       bodyMat.color.clone(),
      transparent: true,
      opacity:     0.8,
    })
    this.ghostMesh = new THREE.Mesh(ghostGeo, ghostMat)
    this.ghostMesh.position.copy(this.position)
    this.ghostMesh.position.y += 0.4 // approximate body center
    scene.add(this.ghostMesh)
    this.ghostTimer = 0.4
    this.position.copy(dest)
    this.blinkCooldown = this.archetype === 'boss' ? 3 : 5
  }
```

- [ ] **Step 8: Run tests and typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS — typecheck clean, all tests including the new Enemy tests green.

- [ ] **Step 9: Manual visual check**

Run: `npm run dev`
Confirm: apprentices, battle mages, warlocks, and all three boss variants render as wizards. Status effects (freeze/burn/stun/slow) tint the robe correctly. Blink leaves a faint robe-shaped ghost. Death animation shrinks the whole figure.

- [ ] **Step 10: Commit**

```bash
git add src/entities/Enemy.ts tests/EnemyScaling.test.ts
git commit -m "refactor: enemies use composite wizard models"
```

---

## Task 6: Idle bob and staff bobble animation

**Files:**
- Modify: `src/entities/Player.ts`
- Modify: `src/entities/Enemy.ts`

- [ ] **Step 1: Add idle animation to Player**

Add a private field:

```ts
  private idleTime = 0
```

In `update()`, after the dodge/heal early returns and before the input block, add:

```ts
    this.idleTime += delta
    this.model.body.position.y = (this.model.body.geometry as THREE.CylinderGeometry).parameters.height / 2
      + Math.sin(this.idleTime * 3) * 0.04
    this.model.orb.rotation.y += delta * 1.5
```

Note: `this.model.body.position.y` was set in the factory; this overlays a small bob. Cache the base value:

```ts
  private readonly bodyBaseY: number  // initialized in constructor:
  // this.bodyBaseY = this.model.body.position.y
```

…and use `this.bodyBaseY + Math.sin(this.idleTime * 3) * 0.04` instead of recomputing from geometry.

- [ ] **Step 2: Add idle animation to Enemy**

Add a private field `private idleTime = 0` and `private readonly bodyBaseY: number`. Cache `this.bodyBaseY = this.model.body.position.y` after building the model.

In `update()`, after the status-effect block and before the orbital-ring block, add:

```ts
    this.idleTime += delta
    this.model.body.position.y = this.bodyBaseY + Math.sin(this.idleTime * (this.archetype === 'boss' ? 1.5 : 2.5)) * 0.05
    this.model.orb.rotation.y += delta * 2
```

- [ ] **Step 3: Run tests and typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 4: Manual visual check**

Run: `npm run dev`
Confirm wizards have a subtle hovering breath animation and staff orbs spin gently.

- [ ] **Step 5: Commit**

```bash
git add src/entities/Player.ts src/entities/Enemy.ts
git commit -m "feat: subtle idle bob animation for wizards"
```

---

## Task 7: Boss staff orb glow scales with phase

**Files:**
- Modify: `src/entities/Enemy.ts`

- [ ] **Step 1: Modify orbital-ring update block to also scale orb emissive**

In `Enemy.update()`, find the existing orbital-ring block (~line 386-392 post-refactor) and extend it:

```ts
    if (this.orbitalRing) {
      this.orbitalAngle += delta * (0.8 + (this.phase - 1) * 1.0)
      this.orbitalRing.rotation.y = this.orbitalAngle
      this.orbitalRing.rotation.x = Math.PI / 2 + Math.sin(this.orbitalAngle * 0.5) * 0.4
      const rm = this.orbitalRing.material as THREE.MeshStandardMaterial
      rm.emissiveIntensity = 1.5 + (this.phase - 1) * 1.5

      // Boss staff orb pulses harder per phase
      const orbMat = this.model.orb.material as THREE.MeshStandardMaterial
      orbMat.emissiveIntensity = 1.6 + (this.phase - 1) * 1.0 + Math.sin(this.idleTime * 6) * 0.4
    }
```

- [ ] **Step 2: Run tests and typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 3: Manual visual check**

Run: `npm run dev`
Trigger a boss fight, confirm the boss's staff orb intensifies as HP drops through phases.

- [ ] **Step 4: Commit**

```bash
git add src/entities/Enemy.ts
git commit -m "feat: boss staff orb intensifies per phase"
```

---

## Self-Review Checklist

- [x] Every task has exact file paths and line ranges.
- [x] Every code step shows actual code, not "TODO" or "implement here".
- [x] `setTint` / `clearTint` / `setOpacity` / `disposeModel` are introduced in Task 4 and used consistently in Tasks 5–7.
- [x] `WizardModel` / `WizardModelConfig` / `buildWizardModel` / `disposeWizardModel` names are consistent across all tasks.
- [x] Existing API contracts preserved: `player.mesh.position`, `player.mesh.scale`, `player.mesh.add`, `enemy.mesh.position`, `enemy.position` all still work because `THREE.Group extends Object3D`.
- [x] Disposal of every new geometry/material is covered (Task 2 helper, used in Tasks 4 and 5).
- [x] Visual smoke check is part of every task that affects rendering.
- [x] Tests run after every task; full suite runs at end of Tasks 4 and 5 to catch regressions in `tests/Spellbook.test.ts` etc.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-26-composite-wizard-geometry.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach?
