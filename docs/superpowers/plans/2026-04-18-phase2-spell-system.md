# Phase 2: Spell System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full 16-spell system with dual spell bars (Tab-toggled), visually distinct projectiles with per-element glow/trail behaviors, special spell effects (Blink, Frozen Nova, Ice Wall, Chain Lightning, etc.), and a fully updated HUD showing both bars with live cooldown sweeps.

**Architecture:** `SpellDefinitions.ts` holds pure data for all 16 spells including visual metadata. `SpellBar.ts` manages the 2×4 slot loadout and active bar. `SpellCaster.ts` handles validation (mana/cooldown) and creates projectile entities; non-projectile effects are dispatched from `Game.ts` to `SpellEffects.ts` effect classes that implement `IEffect` and are stored in an `activeEffects[]` array. `Projectile.ts` drives per-element visual behaviors (fire wobble, lightning spin, arcane rotate, homing). `HUD.ts` renders both bars with cooldown overlays, flash/shake animations, and bar indicator.

**Tech Stack:** Three.js r184, TypeScript 6.0, Vite, Vitest (jsdom)

---

## File Structure

**New files:**
- `src/spells/SpellDefinitions.ts` — replace with full 16-spell registry + visual metadata
- `src/spells/SpellBar.ts` — 2-bar × 4-slot loadout management and toggle
- `src/spells/SpellEffects.ts` — `IEffect` interface + effect classes: `FrozenNovaEffect`, `IceWallEffect`, `StaticFieldEffect`, `ThunderClapEffect`, `ArcaneExplosionEffect`, `LightningBoltEffect`, `FrostDecalEffect`; plus `castBlink` function
- `src/fx/TrailSystem.ts` — pre-allocated 8-ghost circular-buffer trail for projectiles
- `tests/SpellDefinitions.test.ts`
- `tests/SpellBar.test.ts`
- `tests/SpellCaster.test.ts`

**Modified files:**
- `src/spells/SpellCaster.ts` — new time-based cooldown interface (`canCast`, `getCooldownRemaining`, `getCooldownPercent`, `CastResult`), remove `update(delta)`
- `src/entities/Projectile.ts` — full refactor: spell-driven geometry + `PointLight` + `TrailSystem` + element behaviors + `homingTarget` + `jumpsRemaining`
- `src/core/InputManager.ts` — add `mouseX`/`mouseY` NDC tracking; prevent Tab default
- `src/ui/HUD.ts` — dual bar render, cooldown sweeps, `onCastSuccess`, `onCastFail`, `onBarToggle`
- `src/core/Game.ts` — wire `SpellBar`, mouse world raycast, all spell types, `activeEffects[]`, AOE damage + chain lightning jump, frost decals, homing target updates
- `src/constants.ts` — `MANA_REGEN_RATE` 5 → 8
- `index.html` — replace `#spell-bar` with dual-bar structure
- `styles.css` — spell bar styles + element tints + flash/shake/pulse animations

---

## Task 1: SpellDefinitions.ts — 16-spell registry

**Files:**
- Modify: `src/spells/SpellDefinitions.ts`
- Create: `tests/SpellDefinitions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/SpellDefinitions.test.ts
import { describe, it, expect } from 'vitest'
import { SPELLS } from '../src/spells/SpellDefinitions'

const ALL_IDS = [
  'fireball', 'flame_lance', 'ember_shot', 'pyroblast',
  'frost_bolt', 'ice_wall', 'frozen_nova', 'glacial_spike',
  'chain_lightning', 'thunder_clap', 'spark', 'static_field',
  'arcane_missile', 'blink', 'mana_siphon', 'arcane_explosion',
]

describe('SpellDefinitions', () => {
  it('defines exactly 16 spells', () => {
    expect(Object.keys(SPELLS).length).toBe(16)
  })

  it.each(ALL_IDS)('spell %s has base fields', (id) => {
    const s = SPELLS[id]
    expect(s).toBeDefined()
    expect(s.id).toBe(id)
    expect(s.name).toBeTruthy()
    expect(['fire', 'ice', 'lightning', 'arcane']).toContain(s.element)
    expect(['projectile', 'aoe', 'beam', 'self']).toContain(s.type)
    expect(s.manaCost).toBeGreaterThanOrEqual(0)
    expect(s.cooldown).toBeGreaterThan(0)
  })

  it.each(ALL_IDS)('spell %s has visual metadata', (id) => {
    const s = SPELLS[id]
    expect(s.projectileGeometry).toMatch(/^(sphere|cone|cylinder|ring|spike)$/)
    expect(s.projectileScale).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      z: expect.any(Number),
    })
    expect(s.color).toMatch(/^#/)
    expect(s.emissiveColor).toMatch(/^#/)
    expect(s.emissiveIntensity).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/SpellDefinitions.test.ts
```

Expected: fails with `16 !== 1` (only fireball currently defined)

- [ ] **Step 3: Replace SpellDefinitions.ts with all 16 spells**

```typescript
// src/spells/SpellDefinitions.ts
export type SpellElement = 'fire' | 'ice' | 'lightning' | 'arcane'
export type SpellType    = 'projectile' | 'aoe' | 'beam' | 'self'
export type StatusEffectType = 'burning' | 'slow' | 'freeze' | 'stun' | 'knockback'

export interface StatusEffect {
  type: StatusEffectType
  duration: number
  value?: number
}

export interface Spell {
  id:                 string
  name:               string
  element:            SpellElement
  type:               SpellType
  damage:             number
  manaCost:           number
  cooldown:           number
  range:              number
  speed?:             number
  radius?:            number
  duration?:          number
  statusEffect?:      StatusEffect
  description:        string
  masteryEvolvesTo?:  string
  projectileGeometry: 'sphere' | 'cone' | 'cylinder' | 'ring' | 'spike'
  projectileScale:    { x: number; y: number; z: number }
  color:              string
  emissiveColor:      string
  emissiveIntensity:  number
}

export const SPELLS: Record<string, Spell> = {
  // ── FIRE ─────────────────────────────────────────────────────────────────
  fireball: {
    id: 'fireball', name: 'Fireball', element: 'fire', type: 'projectile',
    damage: 30, manaCost: 20, cooldown: 1.5, range: 20, speed: 12,
    description: 'A blazing sphere of fire that immolates enemies on contact.',
    projectileGeometry: 'sphere', projectileScale: { x: 1, y: 1, z: 1 },
    color: '#ff6600', emissiveColor: '#ff4400', emissiveIntensity: 1.5,
  },
  flame_lance: {
    id: 'flame_lance', name: 'Flame Lance', element: 'fire', type: 'projectile',
    damage: 45, manaCost: 30, cooldown: 2.0, range: 18, speed: 20,
    description: 'A piercing lance of concentrated flame.',
    projectileGeometry: 'cylinder', projectileScale: { x: 0.2, y: 3, z: 0.2 },
    color: '#cc2200', emissiveColor: '#ff0000', emissiveIntensity: 2.0,
  },
  ember_shot: {
    id: 'ember_shot', name: 'Ember Shot', element: 'fire', type: 'projectile',
    damage: 12, manaCost: 8, cooldown: 0.4, range: 15, speed: 22,
    description: 'A rapid burst of burning embers.',
    projectileGeometry: 'sphere', projectileScale: { x: 0.3, y: 0.3, z: 0.3 },
    color: '#ffaa00', emissiveColor: '#ffcc00', emissiveIntensity: 2.5,
  },
  pyroblast: {
    id: 'pyroblast', name: 'Pyroblast', element: 'fire', type: 'projectile',
    damage: 80, manaCost: 55, cooldown: 6.0, range: 15, speed: 7, radius: 3.0,
    description: 'A massive fireball that erupts in a wide explosion.',
    projectileGeometry: 'sphere', projectileScale: { x: 2, y: 2, z: 2 },
    color: '#990000', emissiveColor: '#ff4400', emissiveIntensity: 1.0,
  },

  // ── ICE ──────────────────────────────────────────────────────────────────
  frost_bolt: {
    id: 'frost_bolt', name: 'Frost Bolt', element: 'ice', type: 'projectile',
    damage: 25, manaCost: 15, cooldown: 1.2, range: 18, speed: 10,
    statusEffect: { type: 'slow', duration: 2.0, value: 0.5 },
    description: 'A shard of ice that slows its target.',
    projectileGeometry: 'cone', projectileScale: { x: 0.4, y: 1.5, z: 0.4 },
    color: '#aaddff', emissiveColor: '#00ccff', emissiveIntensity: 1.0,
  },
  ice_wall: {
    id: 'ice_wall', name: 'Ice Wall', element: 'ice', type: 'aoe',
    damage: 0, manaCost: 30, cooldown: 8.0, range: 5, duration: 4.0,
    description: 'Raises a wall of ice that blocks passage.',
    projectileGeometry: 'cylinder', projectileScale: { x: 0.5, y: 2, z: 0.5 },
    color: '#aaddff', emissiveColor: '#00ffff', emissiveIntensity: 0.5,
  },
  frozen_nova: {
    id: 'frozen_nova', name: 'Frozen Nova', element: 'ice', type: 'aoe',
    damage: 30, manaCost: 35, cooldown: 4.0, range: 5, radius: 5.0,
    statusEffect: { type: 'freeze', duration: 1.5 },
    description: 'An icy shockwave that freezes all nearby enemies.',
    projectileGeometry: 'ring', projectileScale: { x: 1, y: 1, z: 0.2 },
    color: '#ffffff', emissiveColor: '#00ccff', emissiveIntensity: 2.0,
  },
  glacial_spike: {
    id: 'glacial_spike', name: 'Glacial Spike', element: 'ice', type: 'projectile',
    damage: 50, manaCost: 25, cooldown: 2.5, range: 20, speed: 14,
    statusEffect: { type: 'stun', duration: 0.5 },
    description: 'A massive spike of ice that stuns on impact.',
    projectileGeometry: 'spike', projectileScale: { x: 0.3, y: 2, z: 0.3 },
    color: '#88ccff', emissiveColor: '#aaddff', emissiveIntensity: 1.5,
  },

  // ── LIGHTNING ─────────────────────────────────────────────────────────────
  chain_lightning: {
    id: 'chain_lightning', name: 'Chain Ltng', element: 'lightning', type: 'projectile',
    damage: 25, manaCost: 20, cooldown: 1.5, range: 18, speed: 18,
    description: 'Electricity that jumps between up to 3 enemies.',
    projectileGeometry: 'cylinder', projectileScale: { x: 0.1, y: 1, z: 0.1 },
    color: '#ffff00', emissiveColor: '#ffff00', emissiveIntensity: 3.0,
  },
  thunder_clap: {
    id: 'thunder_clap', name: 'Thunder Clap', element: 'lightning', type: 'aoe',
    damage: 40, manaCost: 35, cooldown: 4.0, range: 5, radius: 5.0,
    statusEffect: { type: 'stun', duration: 0.5 },
    description: 'A thunderous shockwave that stuns nearby enemies.',
    projectileGeometry: 'ring', projectileScale: { x: 3, y: 3, z: 0.3 },
    color: '#ffffff', emissiveColor: '#ffffff', emissiveIntensity: 2.0,
  },
  spark: {
    id: 'spark', name: 'Spark', element: 'lightning', type: 'projectile',
    damage: 8, manaCost: 5, cooldown: 0.25, range: 20, speed: 28,
    description: 'A tiny bolt of lightning — cheap, fast, weak.',
    projectileGeometry: 'sphere', projectileScale: { x: 0.2, y: 0.2, z: 0.2 },
    color: '#ffff44', emissiveColor: '#ffff00', emissiveIntensity: 3.0,
  },
  static_field: {
    id: 'static_field', name: 'Static Field', element: 'lightning', type: 'aoe',
    damage: 15, manaCost: 40, cooldown: 10.0, range: 8, radius: 4.0, duration: 5.0,
    description: 'A persistent electric zone that zaps enemies every 0.5s.',
    projectileGeometry: 'ring', projectileScale: { x: 1, y: 1, z: 0.1 },
    color: '#ffff88', emissiveColor: '#ffff00', emissiveIntensity: 1.5,
  },

  // ── ARCANE ────────────────────────────────────────────────────────────────
  arcane_missile: {
    id: 'arcane_missile', name: 'Arc. Missile', element: 'arcane', type: 'projectile',
    damage: 20, manaCost: 12, cooldown: 0.8, range: 22, speed: 10,
    description: 'A homing missile of pure arcane energy.',
    projectileGeometry: 'sphere', projectileScale: { x: 0.3, y: 0.8, z: 0.3 },
    color: '#aa44ff', emissiveColor: '#8800ff', emissiveIntensity: 2.0,
  },
  blink: {
    id: 'blink', name: 'Blink', element: 'arcane', type: 'self',
    damage: 0, manaCost: 20, cooldown: 3.0, range: 5,
    description: 'Teleport 5 units in your movement direction.',
    projectileGeometry: 'sphere', projectileScale: { x: 0.5, y: 0.5, z: 0.5 },
    color: '#ffffff', emissiveColor: '#ffffff', emissiveIntensity: 1.0,
  },
  mana_siphon: {
    id: 'mana_siphon', name: 'Mana Siphon', element: 'arcane', type: 'beam',
    damage: 12, manaCost: 0, cooldown: 2.0, range: 8, duration: 2.0,
    description: 'A beam that drains enemy health and restores your mana.',
    projectileGeometry: 'cylinder', projectileScale: { x: 0.15, y: 1, z: 0.15 },
    color: '#ff44ff', emissiveColor: '#ff00ff', emissiveIntensity: 2.0,
  },
  arcane_explosion: {
    id: 'arcane_explosion', name: 'Arc. Explode', element: 'arcane', type: 'aoe',
    damage: 60, manaCost: 45, cooldown: 5.0, range: 6, radius: 6.0,
    description: 'A massive arcane detonation centred on the caster.',
    projectileGeometry: 'ring', projectileScale: { x: 4, y: 4, z: 0.2 },
    color: '#dd88ff', emissiveColor: '#aa00ff', emissiveIntensity: 2.0,
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/SpellDefinitions.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/spells/SpellDefinitions.ts tests/SpellDefinitions.test.ts
git commit -m "feat: add full 16-spell registry with visual metadata"
```

---

## Task 2: SpellBar.ts — dual-bar loadout management

**Files:**
- Create: `src/spells/SpellBar.ts`
- Create: `tests/SpellBar.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/SpellBar.test.ts
import { describe, it, expect } from 'vitest'
import { SpellBar } from '../src/spells/SpellBar'

describe('SpellBar', () => {
  it('starts on bar 1', () => {
    expect(new SpellBar().activeBar).toBe(1)
  })

  it('toggleBar switches to bar 2', () => {
    const bar = new SpellBar()
    bar.toggleBar()
    expect(bar.activeBar).toBe(2)
  })

  it('toggleBar back to bar 1', () => {
    const bar = new SpellBar()
    bar.toggleBar()
    bar.toggleBar()
    expect(bar.activeBar).toBe(1)
  })

  it('getActiveBar returns 4 slots', () => {
    expect(new SpellBar().getActiveBar().length).toBe(4)
  })

  it('bar 1 slot 0 defaults to fireball', () => {
    expect(new SpellBar().getSpellAtSlot(0)?.id).toBe('fireball')
  })

  it('bar 1 slot 1 defaults to frost_bolt', () => {
    expect(new SpellBar().getSpellAtSlot(1)?.id).toBe('frost_bolt')
  })

  it('bar 1 slot 2 defaults to chain_lightning', () => {
    expect(new SpellBar().getSpellAtSlot(2)?.id).toBe('chain_lightning')
  })

  it('bar 1 slot 3 defaults to arcane_missile', () => {
    expect(new SpellBar().getSpellAtSlot(3)?.id).toBe('arcane_missile')
  })

  it('bar 2 slot 0 defaults to ember_shot after toggle', () => {
    const bar = new SpellBar()
    bar.toggleBar()
    expect(bar.getSpellAtSlot(0)?.id).toBe('ember_shot')
  })

  it('bar 2 slot 1 defaults to glacial_spike after toggle', () => {
    const bar = new SpellBar()
    bar.toggleBar()
    expect(bar.getSpellAtSlot(1)?.id).toBe('glacial_spike')
  })

  it('bar 2 slot 2 defaults to spark after toggle', () => {
    const bar = new SpellBar()
    bar.toggleBar()
    expect(bar.getSpellAtSlot(2)?.id).toBe('spark')
  })

  it('bar 2 slot 3 defaults to blink after toggle', () => {
    const bar = new SpellBar()
    bar.toggleBar()
    expect(bar.getSpellAtSlot(3)?.id).toBe('blink')
  })

  it('assignSpell updates the specified bar slot', () => {
    const bar = new SpellBar()
    const { SPELLS } = require('../src/spells/SpellDefinitions')
    bar.assignSpell(1, 0, SPELLS.spark)
    expect(bar.getSpellAtSlot(0)?.id).toBe('spark')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/SpellBar.test.ts
```

Expected: fails with module not found

- [ ] **Step 3: Create SpellBar.ts**

```typescript
// src/spells/SpellBar.ts
import { Spell, SPELLS } from './SpellDefinitions'

export class SpellBar {
  bar1: (Spell | null)[] = [
    SPELLS.fireball,
    SPELLS.frost_bolt,
    SPELLS.chain_lightning,
    SPELLS.arcane_missile,
  ]
  bar2: (Spell | null)[] = [
    SPELLS.ember_shot,
    SPELLS.glacial_spike,
    SPELLS.spark,
    SPELLS.blink,
  ]
  activeBar: 1 | 2 = 1

  getActiveBar(): (Spell | null)[] {
    return this.activeBar === 1 ? this.bar1 : this.bar2
  }

  getSpellAtSlot(slot: 0 | 1 | 2 | 3): Spell | null {
    return this.getActiveBar()[slot] ?? null
  }

  toggleBar(): void {
    this.activeBar = this.activeBar === 1 ? 2 : 1
  }

  assignSpell(bar: 1 | 2, slot: number, spell: Spell): void {
    if (bar === 1) this.bar1[slot] = spell
    else this.bar2[slot] = spell
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/SpellBar.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/spells/SpellBar.ts tests/SpellBar.test.ts
git commit -m "feat: add SpellBar with dual-bar slot management and default loadout"
```

---

## Task 3: constants.ts — mana regen rate

**Files:**
- Modify: `src/constants.ts`
- Create: `tests/Player.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/Player.test.ts
import { describe, it, expect } from 'vitest'
import { MANA_REGEN_RATE } from '../src/constants'

describe('Player mana', () => {
  it('regenerates at 8 MP per second', () => {
    expect(MANA_REGEN_RATE).toBe(8)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/Player.test.ts
```

Expected: fails `8 !== 5`

- [ ] **Step 3: Update the constant**

In `src/constants.ts`, change line 9:

```typescript
export const MANA_REGEN_RATE = 8
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/Player.test.ts
```

Expected: passes

- [ ] **Step 5: Commit**

```bash
git add src/constants.ts tests/Player.test.ts
git commit -m "feat: increase mana regen rate to 8 MP/sec"
```

---

## Task 4: InputManager.ts — Tab key + mouse NDC tracking

**Files:**
- Modify: `src/core/InputManager.ts`

No unit test (browser API). Tested by running the game.

- [ ] **Step 1: Replace InputManager.ts**

```typescript
// src/core/InputManager.ts
export class InputManager {
  private held           = new Set<string>()
  private pendingPressed  = new Set<string>()
  private pendingReleased = new Set<string>()
  private _justPressed    = new Set<string>()
  private _justReleased   = new Set<string>()

  /** Normalised Device Coordinates of the mouse, updated on mousemove. */
  mouseX = 0
  mouseY = 0

  private onKeyDown = (e: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(e.key)) {
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

  private onMouseMove = (e: MouseEvent): void => {
    const canvas = document.querySelector('#game-canvas canvas') as HTMLCanvasElement | null
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    this.mouseX = ((e.clientX - rect.left) / rect.width)  * 2 - 1
    this.mouseY = -((e.clientY - rect.top)  / rect.height) * 2 + 1
  }

  constructor() {
    window.addEventListener('keydown',    this.onKeyDown)
    window.addEventListener('keyup',      this.onKeyUp)
    window.addEventListener('mousemove',  this.onMouseMove)
  }

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
    window.removeEventListener('keydown',   this.onKeyDown)
    window.removeEventListener('keyup',     this.onKeyUp)
    window.removeEventListener('mousemove', this.onMouseMove)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/InputManager.ts
git commit -m "feat: add Tab prevention and mouse NDC tracking to InputManager"
```

---

## Task 5: SpellCaster.ts — time-based cooldowns, new interface

**Files:**
- Modify: `src/spells/SpellCaster.ts`
- Create: `tests/SpellCaster.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/SpellCaster.test.ts
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { SpellCaster } from '../src/spells/SpellCaster'
import { SPELLS }      from '../src/spells/SpellDefinitions'

describe('SpellCaster', () => {
  it('canCast returns true when mana is sufficient and not on cooldown', () => {
    const caster = new SpellCaster({ mana: 100 })
    expect(caster.canCast(SPELLS.fireball, 100, 0)).toBe(true)
  })

  it('canCast returns false when mana is insufficient', () => {
    const caster = new SpellCaster({ mana: 5 })
    expect(caster.canCast(SPELLS.fireball, 5, 0)).toBe(false)
  })

  it('canCast returns false when on cooldown', () => {
    const caster = new SpellCaster({ mana: 100 })
    // Manually seed cooldown: lastCastTime = 0
    ;(caster as any).cooldowns.set('fireball', 0)
    // Fireball cooldown is 1.5s; only 0.5s has passed
    expect(caster.canCast(SPELLS.fireball, 100, 0.5)).toBe(false)
  })

  it('canCast returns true once cooldown has expired', () => {
    const caster = new SpellCaster({ mana: 100 })
    ;(caster as any).cooldowns.set('fireball', 0)
    expect(caster.canCast(SPELLS.fireball, 100, 2.0)).toBe(true)
  })

  it('getCooldownRemaining returns 0 when never cast', () => {
    const caster = new SpellCaster({ mana: 100 })
    expect(caster.getCooldownRemaining('fireball', 0)).toBe(0)
  })

  it('getCooldownRemaining returns time left mid-cooldown', () => {
    const caster = new SpellCaster({ mana: 100 })
    ;(caster as any).cooldowns.set('fireball', 0)
    // 1.5s cooldown - 0.5s elapsed = 1.0 remaining
    expect(caster.getCooldownRemaining('fireball', 0.5)).toBeCloseTo(1.0)
  })

  it('getCooldownRemaining returns 0 after cooldown expires', () => {
    const caster = new SpellCaster({ mana: 100 })
    ;(caster as any).cooldowns.set('fireball', 0)
    expect(caster.getCooldownRemaining('fireball', 3.0)).toBe(0)
  })

  it('getCooldownPercent returns 0 when never cast', () => {
    const caster = new SpellCaster({ mana: 100 })
    expect(caster.getCooldownPercent('fireball', 0)).toBe(0)
  })

  it('getCooldownPercent returns 1 immediately after cast', () => {
    const caster = new SpellCaster({ mana: 100 })
    ;(caster as any).cooldowns.set('fireball', 0)
    expect(caster.getCooldownPercent('fireball', 0)).toBe(1)
  })

  it('getCooldownPercent returns 0 once cooldown expires', () => {
    const caster = new SpellCaster({ mana: 100 })
    ;(caster as any).cooldowns.set('fireball', 0)
    expect(caster.getCooldownPercent('fireball', 5.0)).toBe(0)
  })

  it('cast deducts mana on success', () => {
    const player = { mana: 100 }
    const caster = new SpellCaster(player)
    const scene  = new THREE.Scene()
    const entity = { position: new THREE.Vector3(), mesh: new THREE.Mesh(), alive: true }
    const dir    = new THREE.Vector3(0, 0, 1)
    caster.cast(SPELLS.fireball, entity, [], scene, 0, dir)
    expect(player.mana).toBe(80)
  })

  it('cast returns projectile for projectile-type spells', () => {
    const caster = new SpellCaster({ mana: 100 })
    const scene  = new THREE.Scene()
    const entity = { position: new THREE.Vector3(), mesh: new THREE.Mesh(), alive: true }
    const dir    = new THREE.Vector3(0, 0, 1)
    const result = caster.cast(SPELLS.fireball, entity, [], scene, 0, dir)
    expect(result.success).toBe(true)
    expect(result.projectile).toBeDefined()
  })

  it('cast returns spellId for non-projectile spells', () => {
    const caster = new SpellCaster({ mana: 100 })
    const scene  = new THREE.Scene()
    const entity = { position: new THREE.Vector3(), mesh: new THREE.Mesh(), alive: true }
    const result = caster.cast(SPELLS.blink, entity, [], scene, 0)
    expect(result.success).toBe(true)
    expect(result.spellId).toBe('blink')
    expect(result.projectile).toBeUndefined()
  })

  it('cast fails with no_mana when mana is insufficient', () => {
    const caster = new SpellCaster({ mana: 5 })
    const scene  = new THREE.Scene()
    const entity = { position: new THREE.Vector3(), mesh: new THREE.Mesh(), alive: true }
    const result = caster.cast(SPELLS.fireball, entity, [], scene, 0, new THREE.Vector3(0, 0, 1))
    expect(result.success).toBe(false)
    expect(result.failReason).toBe('no_mana')
  })

  it('cast fails with on_cooldown when spell is on cooldown', () => {
    const caster = new SpellCaster({ mana: 100 })
    const scene  = new THREE.Scene()
    const entity = { position: new THREE.Vector3(), mesh: new THREE.Mesh(), alive: true }
    const dir    = new THREE.Vector3(0, 0, 1)
    caster.cast(SPELLS.fireball, entity, [], scene, 0, dir)        // cast at t=0
    const result = caster.cast(SPELLS.fireball, entity, [], scene, 0.1, dir)  // 0.1s later
    expect(result.success).toBe(false)
    expect(result.failReason).toBe('on_cooldown')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/SpellCaster.test.ts
```

Expected: multiple failures (wrong interface)

- [ ] **Step 3: Replace SpellCaster.ts**

```typescript
// src/spells/SpellCaster.ts
import * as THREE from 'three'
import { Spell, SPELLS } from './SpellDefinitions'
import { Projectile }    from '../entities/Projectile'

export interface Entity {
  position: THREE.Vector3
  mesh:     THREE.Mesh
  alive:    boolean
}

export interface CastResult {
  success:     boolean
  failReason?: 'no_mana' | 'on_cooldown'
  projectile?: Projectile
  spellId?:    string
}

export class SpellCaster {
  /** spellId → timestamp of last cast (from THREE.Clock.getElapsedTime) */
  private cooldowns = new Map<string, number>()
  private manaSrc:   { mana: number }

  constructor(manaSrc: { mana: number }) {
    this.manaSrc = manaSrc
  }

  canCast(spell: Spell, currentMana: number, currentTime: number): boolean {
    if (currentMana < spell.manaCost) return false
    return this.getCooldownRemaining(spell.id, currentTime) <= 0
  }

  cast(
    spell:       Spell,
    caster:      Entity,
    targets:     Entity[],
    scene:       THREE.Scene,
    currentTime: number,
    direction?:  THREE.Vector3,
  ): CastResult {
    if (this.manaSrc.mana < spell.manaCost) {
      return { success: false, failReason: 'no_mana' }
    }
    if (this.getCooldownRemaining(spell.id, currentTime) > 0) {
      return { success: false, failReason: 'on_cooldown' }
    }

    this.manaSrc.mana -= spell.manaCost
    this.cooldowns.set(spell.id, currentTime)

    if (spell.type === 'projectile') {
      const dir = direction ?? this.directionToNearest(targets, caster.position)
      const origin = caster.position.clone().setY(0.75)
      const proj = new Projectile(origin, dir, spell, scene)
      return { success: true, projectile: proj }
    }

    // aoe / beam / self — Game.ts handles the actual effect via spellId
    return { success: true, spellId: spell.id }
  }

  getCooldownRemaining(spellId: string, currentTime: number): number {
    const spell    = SPELLS[spellId]
    if (!spell) return 0
    const lastCast = this.cooldowns.get(spellId)
    if (lastCast === undefined) return 0
    return Math.max(0, spell.cooldown - (currentTime - lastCast))
  }

  /** Returns 1 immediately after cast, decreasing to 0 as cooldown expires. */
  getCooldownPercent(spellId: string, currentTime: number): number {
    const spell = SPELLS[spellId]
    if (!spell || spell.cooldown <= 0) return 0
    return this.getCooldownRemaining(spellId, currentTime) / spell.cooldown
  }

  private directionToNearest(targets: Entity[], origin: THREE.Vector3): THREE.Vector3 {
    const alive = targets.filter(t => t.alive)
    if (alive.length === 0) return new THREE.Vector3(0, 0, 1)
    let nearest  = alive[0]
    let minDist  = origin.distanceTo(nearest.position)
    for (const t of alive.slice(1)) {
      const d = origin.distanceTo(t.position)
      if (d < minDist) { minDist = d; nearest = t }
    }
    return new THREE.Vector3()
      .subVectors(nearest.position, origin)
      .setY(0)
      .normalize()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/SpellCaster.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass (SpellDefinitions, SpellBar, Player, SpellCaster)

- [ ] **Step 6: Commit**

```bash
git add src/spells/SpellCaster.ts tests/SpellCaster.test.ts
git commit -m "feat: refactor SpellCaster to time-based cooldowns with canCast/CastResult interface"
```

---

## Task 6: TrailSystem.ts — 8-ghost particle trail

**Files:**
- Create: `src/fx/TrailSystem.ts`

No unit test (visual). Verified by running the game.

- [ ] **Step 1: Create src/fx/TrailSystem.ts**

```typescript
// src/fx/TrailSystem.ts
import * as THREE from 'three'

/**
 * Circular buffer of 8 ghost meshes that follow a moving object.
 * The newest ghost has opacity 0.53, oldest approaches 0.
 * All ghosts share one SphereGeometry; each has its own material.
 */
export class TrailSystem {
  private readonly ghosts:    THREE.Mesh[]
  private readonly positions: THREE.Vector3[]
  private readonly size = 8
  private head = 0
  private filled = 0

  constructor(color: string, scene: THREE.Scene) {
    const geo = new THREE.SphereGeometry(0.1, 4, 3)
    this.ghosts = Array.from({ length: this.size }, () => {
      const mat  = new THREE.MeshBasicMaterial({
        color:       new THREE.Color(color),
        transparent: true,
        opacity:     0,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      scene.add(mesh)
      return mesh
    })
    this.positions = Array.from({ length: this.size }, () => new THREE.Vector3())
  }

  /** Call once per frame with the projectile's current world position. */
  update(currentPosition: THREE.Vector3): void {
    this.positions[this.head].copy(currentPosition)
    this.head   = (this.head + 1) % this.size
    this.filled = Math.min(this.filled + 1, this.size)

    for (let i = 0; i < this.size; i++) {
      // Index into positions array, walking backward from newest
      const posIdx   = (this.head - 1 - i + this.size) % this.size
      const ghost    = this.ghosts[posIdx]
      if (i >= this.filled) {
        ghost.visible = false
        continue
      }
      ghost.position.copy(this.positions[posIdx])
      ghost.visible = true
      // opacity: 0.6 at i=0 (newest trail), 0 at i=size-1 (oldest)
      ;(ghost.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, 0.6 * (1 - (i + 1) / (this.size + 1)))
    }
  }

  dispose(scene: THREE.Scene): void {
    const geo = this.ghosts[0]?.geometry
    for (const g of this.ghosts) {
      g.visible = false
      scene.remove(g)
      ;(g.material as THREE.MeshBasicMaterial).dispose()
    }
    geo?.dispose()
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/fx/TrailSystem.ts
git commit -m "feat: add TrailSystem — circular-buffer 8-ghost particle trail"
```

---

## Task 7: Projectile.ts — full refactor with glow, trail, element behaviors

**Files:**
- Modify: `src/entities/Projectile.ts`

No unit test (visual/Three.js rendering). Verified by running the game.

Note: The Projectile constructor now takes a `THREE.Scene` and adds itself to the scene — callers no longer call `scene.add()` manually.

- [ ] **Step 1: Replace Projectile.ts**

```typescript
// src/entities/Projectile.ts
import * as THREE         from 'three'
import { Spell }          from '../spells/SpellDefinitions'
import { TrailSystem }    from '../fx/TrailSystem'
import type { RoomBounds } from '../dungeon/Room'
import { isOutOfBounds }  from '../utils/CollisionUtils'

export class Projectile {
  readonly mesh:  THREE.Mesh
  readonly light: THREE.PointLight
  readonly spell: Spell
  readonly velocity: THREE.Vector3
  readonly origin:   THREE.Vector3
  readonly damage:   number
  alive = true

  /** Set by Game.ts each frame for 'arcane_missile' to steer toward. */
  homingTarget?: THREE.Vector3

  /** Non-zero only for 'chain_lightning'; decremented on each jump. */
  jumpsRemaining: number

  private trail:       TrailSystem
  private elapsedTime = 0

  constructor(
    origin:         THREE.Vector3,
    direction:      THREE.Vector3,
    spell:          Spell,
    scene:          THREE.Scene,
    jumpsRemaining  = 0,
  ) {
    this.origin         = origin.clone()
    this.spell          = spell
    this.damage         = spell.damage
    this.jumpsRemaining = jumpsRemaining
    this.velocity = direction.clone().normalize().multiplyScalar(spell.speed ?? 10)

    const geo = this.buildGeometry(spell)
    const mat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color(spell.color),
      emissive:          new THREE.Color(spell.emissiveColor),
      emissiveIntensity: spell.emissiveIntensity,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.scale.set(spell.projectileScale.x, spell.projectileScale.y, spell.projectileScale.z)
    this.mesh.position.copy(origin)

    // Align cone/cylinder/spike along the travel direction
    if (['cone', 'cylinder', 'spike'].includes(spell.projectileGeometry)) {
      const up  = new THREE.Vector3(0, 1, 0)
      const vel = direction.clone().normalize()
      if (Math.abs(up.dot(vel)) < 0.99) {
        this.mesh.quaternion.setFromUnitVectors(up, vel)
      }
    }

    this.light = new THREE.PointLight(
      new THREE.Color(spell.emissiveColor),
      spell.emissiveIntensity * 2,
      8,
    )
    this.light.position.copy(origin)

    scene.add(this.mesh)
    scene.add(this.light)
    this.trail = new TrailSystem(spell.color, scene)
  }

  update(delta: number, bounds: RoomBounds, scene: THREE.Scene): void {
    if (!this.alive) return
    this.elapsedTime += delta

    // ── Homing: arcane_missile steers toward homingTarget ──────────────────
    if (this.spell.id === 'arcane_missile' && this.homingTarget) {
      const speed = this.velocity.length()
      const toTarget = new THREE.Vector3()
        .subVectors(this.homingTarget, this.mesh.position)
        .setY(0)
        .normalize()
        .multiplyScalar(speed)
      this.velocity.lerp(toTarget, 2.5 * delta)
      // Preserve speed after lerp
      const currentSpeed = this.velocity.length()
      if (currentSpeed > 0) this.velocity.multiplyScalar(speed / currentSpeed)
    }

    // ── Movement ────────────────────────────────────────────────────────────
    this.mesh.position.x += this.velocity.x * delta
    this.mesh.position.z += this.velocity.z * delta
    this.light.position.copy(this.mesh.position)

    // ── Element-specific visuals ─────────────────────────────────────────────
    if (this.spell.element === 'fire') {
      const wobble = 1 + Math.sin(this.elapsedTime * 15) * 0.05
      this.mesh.scale.set(
        this.spell.projectileScale.x * wobble,
        this.spell.projectileScale.y * wobble,
        this.spell.projectileScale.z * wobble,
      )
    } else if (this.spell.element === 'lightning') {
      this.mesh.rotation.y += delta * 12
    } else if (this.spell.element === 'arcane') {
      this.mesh.rotation.y += delta * 2
    }

    this.trail.update(this.mesh.position)

    // ── Range / bounds check ────────────────────────────────────────────────
    const travelled = this.mesh.position.distanceTo(this.origin)
    if (
      travelled > this.spell.range ||
      isOutOfBounds(this.mesh.position.x, this.mesh.position.z, bounds)
    ) {
      this.destroy(scene)
    }
  }

  destroy(scene: THREE.Scene): void {
    if (!this.alive) return
    this.alive = false
    scene.remove(this.mesh)
    scene.remove(this.light)
    this.trail.dispose(scene)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.MeshStandardMaterial).dispose()
  }

  private buildGeometry(spell: Spell): THREE.BufferGeometry {
    switch (spell.projectileGeometry) {
      case 'sphere':   return new THREE.SphereGeometry(0.5, 8, 6)
      case 'cone':     return new THREE.ConeGeometry(0.5, 1, 8)
      case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 8)
      case 'ring':     return new THREE.TorusGeometry(0.5, 0.1, 8, 16)
      case 'spike':    return new THREE.ConeGeometry(0.1, 1, 6)
      default:         return new THREE.SphereGeometry(0.5, 8, 6)
    }
  }
}
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass (Projectile.ts has no unit tests; this verifies the codebase still compiles)

- [ ] **Step 3: Commit**

```bash
git add src/entities/Projectile.ts src/fx/TrailSystem.ts
git commit -m "feat: refactor Projectile — spell-driven geometry, PointLight glow, TrailSystem, element behaviors"
```

---

## Task 8: SpellEffects.ts — special spell behaviors

**Files:**
- Create: `src/spells/SpellEffects.ts`

No unit test (Three.js visual). Verified by casting each special spell in the game.

- [ ] **Step 1: Create src/spells/SpellEffects.ts**

```typescript
// src/spells/SpellEffects.ts
import * as THREE  from 'three'
import type { Enemy } from '../entities/Enemy'
import { SPELLS } from './SpellDefinitions'

// ── Shared interface for time-tracked effects ──────────────────────────────

export interface IEffect {
  alive: boolean
  update(delta: number, scene: THREE.Scene, enemies: Enemy[]): void
  dispose(scene: THREE.Scene): void
}

// ── Blink — instant self teleport ─────────────────────────────────────────

export function castBlink(
  position:      THREE.Vector3,
  mesh:          THREE.Mesh,
  lastDirection: THREE.Vector3,
): void {
  position.x += lastDirection.x * 5
  position.z += lastDirection.z * 5
  mesh.position.copy(position)

  const mat = mesh.material as THREE.MeshStandardMaterial
  const savedEmissive    = mat.emissive.clone()
  const savedIntensity   = mat.emissiveIntensity
  mat.emissive.set(0xffffff)
  mat.emissiveIntensity = 1
  setTimeout(() => {
    mat.emissive.copy(savedEmissive)
    mat.emissiveIntensity = savedIntensity
  }, 100)
}

// ── Frozen Nova ────────────────────────────────────────────────────────────

export class FrozenNovaEffect implements IEffect {
  alive = true
  private ring:          THREE.Mesh
  private timer          = 0
  private damageApplied  = false
  private readonly expandDuration = 0.3
  private readonly totalDuration  = 0.5
  private readonly maxRadius:     number

  constructor(
    private readonly center:  THREE.Vector3,
    private readonly enemies: Enemy[],
    private readonly damage:  number,
    scene: THREE.Scene,
  ) {
    this.maxRadius = SPELLS.frozen_nova.radius ?? 5
    const geo = new THREE.TorusGeometry(this.maxRadius, 0.2, 8, 32)
    const mat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color('#aaddff'),
      emissive:          new THREE.Color('#00ccff'),
      emissiveIntensity: 2.0,
      transparent:       true,
      opacity:           0.8,
    })
    this.ring = new THREE.Mesh(geo, mat)
    this.ring.position.set(center.x, 0.5, center.z)
    this.ring.rotation.x = -Math.PI / 2
    this.ring.scale.set(0.01, 0.01, 1)
    scene.add(this.ring)
  }

  update(delta: number, scene: THREE.Scene, _enemies: Enemy[]): void {
    this.timer += delta
    const progress = Math.min(this.timer / this.expandDuration, 1)
    this.ring.scale.set(progress, progress, 1)

    if (!this.damageApplied && progress >= 1) {
      this.applyDamage(scene)
      this.damageApplied = true
    }

    if (this.timer > this.expandDuration) {
      const fade = 1 - (this.timer - this.expandDuration) / (this.totalDuration - this.expandDuration)
      ;(this.ring.material as THREE.MeshStandardMaterial).opacity = 0.8 * Math.max(0, fade)
    }

    if (this.timer >= this.totalDuration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  private applyDamage(scene: THREE.Scene): void {
    const r2 = this.maxRadius * this.maxRadius
    for (const e of this.enemies) {
      if (!e.alive) continue
      const dx = e.position.x - this.center.x
      const dz = e.position.z - this.center.z
      if (dx * dx + dz * dz <= r2) {
        e.takeDamage(this.damage, scene)
      }
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.ring)
    this.ring.geometry.dispose()
    ;(this.ring.material as THREE.MeshStandardMaterial).dispose()
  }
}

// ── Ice Wall ───────────────────────────────────────────────────────────────

export class IceWallEffect implements IEffect {
  alive = true
  private walls:  THREE.Mesh[] = []
  private timer   = 0
  private readonly duration  = 4.0
  private readonly fadeStart = 3.5

  constructor(
    position:  THREE.Vector3,
    direction: THREE.Vector3,
    scene:     THREE.Scene,
  ) {
    const perp    = new THREE.Vector3(-direction.z, 0, direction.x)
    const offsets = [-1.2, 0, 1.2]
    for (const offset of offsets) {
      const geo = new THREE.BoxGeometry(0.6, 2.5, 0.3)
      const mat = new THREE.MeshStandardMaterial({
        color:             new THREE.Color('#aaddff'),
        emissive:          new THREE.Color('#00ffff'),
        emissiveIntensity: 0.5,
        transparent:       true,
        opacity:           0.85,
      })
      const wall = new THREE.Mesh(geo, mat)
      wall.position
        .copy(position)
        .addScaledVector(direction, 1.5)
        .addScaledVector(perp, offset)
      wall.position.y = 1.25
      // Face perpendicular to the cast direction
      wall.lookAt(wall.position.clone().addScaledVector(perp, 1))
      scene.add(wall)
      this.walls.push(wall)
    }
  }

  update(delta: number, scene: THREE.Scene, _enemies: Enemy[]): void {
    this.timer += delta
    if (this.timer >= this.fadeStart) {
      const fade = 1 - (this.timer - this.fadeStart) / (this.duration - this.fadeStart)
      for (const w of this.walls) {
        ;(w.material as THREE.MeshStandardMaterial).opacity = 0.85 * Math.max(0, fade)
      }
    }
    if (this.timer >= this.duration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  dispose(scene: THREE.Scene): void {
    for (const w of this.walls) {
      scene.remove(w)
      w.geometry.dispose()
      ;(w.material as THREE.MeshStandardMaterial).dispose()
    }
    this.walls = []
  }
}

// ── Thunder Clap — instant AOE with brief ring visual ─────────────────────

export class ThunderClapEffect implements IEffect {
  alive = true
  private ring:  THREE.Mesh
  private timer  = 0
  private readonly duration = 0.35

  constructor(
    position: THREE.Vector3,
    enemies:  Enemy[],
    damage:   number,
    radius:   number,
    scene:    THREE.Scene,
  ) {
    // Instant damage
    const r2 = radius * radius
    for (const e of enemies) {
      if (!e.alive) continue
      const dx = e.position.x - position.x
      const dz = e.position.z - position.z
      if (dx * dx + dz * dz <= r2) e.takeDamage(damage, scene)
    }

    const geo = new THREE.TorusGeometry(radius * 0.9, 0.15, 8, 32)
    const mat = new THREE.MeshStandardMaterial({
      color:             0xffffff,
      emissive:          new THREE.Color(0xffffff),
      emissiveIntensity: 2.0,
      transparent:       true,
      opacity:           0.9,
    })
    this.ring = new THREE.Mesh(geo, mat)
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.set(position.x, 0.3, position.z)
    scene.add(this.ring)
  }

  update(delta: number, scene: THREE.Scene, _enemies: Enemy[]): void {
    this.timer += delta
    ;(this.ring.material as THREE.MeshStandardMaterial).opacity =
      0.9 * Math.max(0, 1 - this.timer / this.duration)
    if (this.timer >= this.duration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.ring)
    this.ring.geometry.dispose()
    ;(this.ring.material as THREE.MeshStandardMaterial).dispose()
  }
}

// ── Arcane Explosion — instant large AOE ──────────────────────────────────

export class ArcaneExplosionEffect implements IEffect {
  alive = true
  private ring:  THREE.Mesh
  private timer  = 0
  private readonly duration = 0.4

  constructor(
    position: THREE.Vector3,
    enemies:  Enemy[],
    damage:   number,
    radius:   number,
    scene:    THREE.Scene,
  ) {
    const r2 = radius * radius
    for (const e of enemies) {
      if (!e.alive) continue
      const dx = e.position.x - position.x
      const dz = e.position.z - position.z
      if (dx * dx + dz * dz <= r2) e.takeDamage(damage, scene)
    }

    const geo = new THREE.TorusGeometry(radius * 0.9, 0.2, 8, 32)
    const mat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color('#dd88ff'),
      emissive:          new THREE.Color('#aa00ff'),
      emissiveIntensity: 2.0,
      transparent:       true,
      opacity:           0.85,
    })
    this.ring = new THREE.Mesh(geo, mat)
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.set(position.x, 0.3, position.z)
    scene.add(this.ring)
  }

  update(delta: number, scene: THREE.Scene, _enemies: Enemy[]): void {
    this.timer += delta
    ;(this.ring.material as THREE.MeshStandardMaterial).opacity =
      0.85 * Math.max(0, 1 - this.timer / this.duration)
    if (this.timer >= this.duration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.ring)
    this.ring.geometry.dispose()
    ;(this.ring.material as THREE.MeshStandardMaterial).dispose()
  }
}

// ── Static Field — persistent zapping zone ────────────────────────────────

export class StaticFieldEffect implements IEffect {
  alive = true
  private zone:        THREE.Mesh
  private totalTimer   = 0
  private tickTimer    = 0
  private readonly duration     = SPELLS.static_field.duration ?? 5
  private readonly tickInterval = 0.5
  private readonly radius       = SPELLS.static_field.radius ?? 4
  private readonly damage       = SPELLS.static_field.damage

  constructor(
    position: THREE.Vector3,
    scene:    THREE.Scene,
  ) {
    const geo = new THREE.CylinderGeometry(this.radius, this.radius, 0.1, 24)
    const mat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color(SPELLS.static_field.color),
      emissive:          new THREE.Color(SPELLS.static_field.emissiveColor),
      emissiveIntensity: SPELLS.static_field.emissiveIntensity,
      transparent:       true,
      opacity:           0.35,
    })
    this.zone = new THREE.Mesh(geo, mat)
    this.zone.position.set(position.x, 0.05, position.z)
    scene.add(this.zone)
  }

  update(delta: number, scene: THREE.Scene, enemies: Enemy[]): void {
    this.totalTimer += delta
    this.tickTimer  += delta

    // Pulse
    const pulse = 1 + Math.sin(this.totalTimer * 8) * 0.3
    ;(this.zone.material as THREE.MeshStandardMaterial).emissiveIntensity =
      SPELLS.static_field.emissiveIntensity * pulse

    if (this.tickTimer >= this.tickInterval) {
      this.tickTimer -= this.tickInterval
      this.zapEnemies(enemies, scene)
    }

    if (this.totalTimer >= this.duration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  private zapEnemies(enemies: Enemy[], scene: THREE.Scene): void {
    const r2 = this.radius * this.radius
    const center = this.zone.position
    for (const e of enemies) {
      if (!e.alive) continue
      const dx = e.position.x - center.x
      const dz = e.position.z - center.z
      if (dx * dx + dz * dz <= r2) {
        e.takeDamage(this.damage, scene)
        // Spawn brief lightning bolt from zone center to enemy
        scene.add(this.makeBolt(center, e.position))
      }
    }
  }

  private makeBolt(from: THREE.Vector3, to: THREE.Vector3): THREE.Line {
    const points = [from.clone().setY(0.5), to.clone().setY(0.75)]
    const geo    = new THREE.BufferGeometry().setFromPoints(points)
    const mat    = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8 })
    const line   = new THREE.Line(geo, mat)
    // Auto-remove after 0.15s (fire-and-forget)
    setTimeout(() => {
      line.parent?.remove(line)
      geo.dispose()
      mat.dispose()
    }, 150)
    return line
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.zone)
    this.zone.geometry.dispose()
    ;(this.zone.material as THREE.MeshStandardMaterial).dispose()
  }
}

// ── Lightning Bolt — brief glowing line for chain-lightning jumps ──────────

export class LightningBoltEffect implements IEffect {
  alive = true
  private line:  THREE.Line
  private timer  = 0
  private readonly duration = 0.2

  constructor(from: THREE.Vector3, to: THREE.Vector3, scene: THREE.Scene) {
    const points = [from.clone().setY(0.75), to.clone().setY(0.75)]
    const geo    = new THREE.BufferGeometry().setFromPoints(points)
    const mat    = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 1.0 })
    this.line    = new THREE.Line(geo, mat)
    scene.add(this.line)
  }

  update(delta: number, scene: THREE.Scene, _enemies: Enemy[]): void {
    this.timer += delta
    ;(this.line.material as THREE.LineBasicMaterial).opacity =
      Math.max(0, 1 - this.timer / this.duration)
    if (this.timer >= this.duration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.line)
    this.line.geometry.dispose()
    ;(this.line.material as THREE.LineBasicMaterial).dispose()
  }
}

// ── Frost Decal — ice impact mark on the floor ────────────────────────────

export class FrostDecalEffect implements IEffect {
  alive = true
  private mesh:  THREE.Mesh
  private timer  = 0
  private readonly duration = 2.0

  constructor(position: THREE.Vector3, scene: THREE.Scene) {
    const geo = new THREE.CircleGeometry(0.8, 12)
    const mat = new THREE.MeshBasicMaterial({
      color:       0xaaddff,
      transparent: true,
      opacity:     0.5,
      side:        THREE.DoubleSide,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.position.set(position.x, 0.01, position.z)
    scene.add(this.mesh)
  }

  update(delta: number, scene: THREE.Scene, _enemies: Enemy[]): void {
    this.timer += delta
    ;(this.mesh.material as THREE.MeshBasicMaterial).opacity =
      0.5 * Math.max(0, 1 - this.timer / this.duration)
    if (this.timer >= this.duration) {
      this.alive = false
      this.dispose(scene)
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.MeshBasicMaterial).dispose()
  }
}
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass (SpellEffects.ts has no unit tests; this verifies compilation)

- [ ] **Step 3: Commit**

```bash
git add src/spells/SpellEffects.ts
git commit -m "feat: add SpellEffects — Blink, FrozenNova, IceWall, ThunderClap, ArcaneExplosion, StaticField, LightningBolt, FrostDecal"
```

---

## Task 9: HUD + index.html + styles.css — dual spell bar UI

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/ui/HUD.ts`

No unit test (DOM visual). Verified by running the game.

- [ ] **Step 1: Replace the #spell-bar section in index.html**

Replace lines 28–44 (the `<div id="spell-bar">` block) with:

```html
      <div id="spell-bars">
        <div class="spell-bar" id="bar-1">
          <div class="spell-slot" id="bar1-slot-0">
            <div class="slot-cooldown" id="bar1-cd-0"></div>
            <div class="slot-key">Q</div>
            <div class="slot-name" id="bar1-name-0">Fireball</div>
            <div class="slot-cost" id="bar1-cost-0">20</div>
          </div>
          <div class="spell-slot" id="bar1-slot-1">
            <div class="slot-cooldown" id="bar1-cd-1"></div>
            <div class="slot-key">W</div>
            <div class="slot-name" id="bar1-name-1">Frost Bolt</div>
            <div class="slot-cost" id="bar1-cost-1">15</div>
          </div>
          <div class="spell-slot" id="bar1-slot-2">
            <div class="slot-cooldown" id="bar1-cd-2"></div>
            <div class="slot-key">E</div>
            <div class="slot-name" id="bar1-name-2">Chain Ltng</div>
            <div class="slot-cost" id="bar1-cost-2">20</div>
          </div>
          <div class="spell-slot" id="bar1-slot-3">
            <div class="slot-cooldown" id="bar1-cd-3"></div>
            <div class="slot-key">R</div>
            <div class="slot-name" id="bar1-name-3">Arc.Missile</div>
            <div class="slot-cost" id="bar1-cost-3">12</div>
          </div>
        </div>

        <div id="bar-indicator">BAR 1<br><span class="tab-hint">TAB</span></div>

        <div class="spell-bar inactive" id="bar-2">
          <div class="spell-slot" id="bar2-slot-0">
            <div class="slot-cooldown" id="bar2-cd-0"></div>
            <div class="slot-key">Q</div>
            <div class="slot-name" id="bar2-name-0">Ember Shot</div>
            <div class="slot-cost" id="bar2-cost-0">8</div>
          </div>
          <div class="spell-slot" id="bar2-slot-1">
            <div class="slot-cooldown" id="bar2-cd-1"></div>
            <div class="slot-key">W</div>
            <div class="slot-name" id="bar2-name-1">Glac.Spike</div>
            <div class="slot-cost" id="bar2-cost-1">25</div>
          </div>
          <div class="spell-slot" id="bar2-slot-2">
            <div class="slot-cooldown" id="bar2-cd-2"></div>
            <div class="slot-key">E</div>
            <div class="slot-name" id="bar2-name-2">Spark</div>
            <div class="slot-cost" id="bar2-cost-2">5</div>
          </div>
          <div class="spell-slot" id="bar2-slot-3">
            <div class="slot-cooldown" id="bar2-cd-3"></div>
            <div class="slot-key">R</div>
            <div class="slot-name" id="bar2-name-3">Blink</div>
            <div class="slot-cost" id="bar2-cost-3">20</div>
          </div>
        </div>
      </div>
```

- [ ] **Step 2: Replace the spell bar CSS in styles.css**

Remove the old `#spell-bar` and `.spell-slot` rules (lines 69–108) and add:

```css
/* ── Spell Bars ─────────────────────────────────────────────────────────── */

#spell-bars {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
}

.spell-bar {
  display: flex;
  gap: 6px;
  transition: opacity 0.15s;
}

.spell-bar.inactive { opacity: 0.4; }
.spell-bar.active   { opacity: 1.0; }

#bar-indicator {
  font-size: 10px;
  color: #ccc;
  text-align: center;
  line-height: 1.3;
  min-width: 32px;
}

.tab-hint {
  font-size: 9px;
  color: #888;
}

.spell-slot {
  position: relative;
  width: 72px;
  height: 82px;
  border: 2px solid #555;
  border-radius: 4px;
  background: #111;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  overflow: hidden;
}

/* Element tints */
.spell-slot[data-element="fire"]      { border-color: #ff6600; background: rgba(255,100,0,0.12); }
.spell-slot[data-element="ice"]       { border-color: #44aaff; background: rgba(68,170,255,0.10); }
.spell-slot[data-element="lightning"] { border-color: #ffff44; background: rgba(255,255,68,0.10); }
.spell-slot[data-element="arcane"]    { border-color: #bb44ff; background: rgba(187,68,255,0.10); }

.slot-key  { color: #fff;    font-size: 18px; font-weight: bold; z-index: 1; }
.slot-name { color: #ddd;    font-size: 9px;  text-align: center; z-index: 1; }
.slot-cost { color: #66aaff; font-size: 8px;  z-index: 1; }

.slot-cooldown {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 0%;
  background: rgba(0,0,0,0.72);
  transition: none;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 4px;
  font-size: 11px;
  color: #fff;
  font-weight: bold;
  z-index: 2;
}

/* Flash on successful cast */
@keyframes slot-flash {
  0%   { background-color: rgba(255,255,255,0.55); }
  100% { background-color: transparent; }
}
.slot-flash { animation: slot-flash 0.15s ease forwards; }

/* Shake on mana failure */
@keyframes slot-shake {
  0%, 100% { transform: translateX(0); }
  25%       { transform: translateX(-4px); }
  75%       { transform: translateX(4px); }
}
.slot-shake { animation: slot-shake 0.2s ease; }

/* Bar indicator pulse on toggle */
@keyframes indicator-pulse {
  0%   { color: #fff; text-shadow: 0 0 8px #fff; }
  100% { color: #ccc; text-shadow: none; }
}
.pulse { animation: indicator-pulse 0.5s ease forwards; }
```

- [ ] **Step 3: Replace HUD.ts**

```typescript
// src/ui/HUD.ts
import type { Player }     from '../entities/Player'
import type { SpellCaster } from '../spells/SpellCaster'
import type { SpellBar }    from '../spells/SpellBar'

export class HUD {
  private hpFill!:       HTMLElement
  private manaFill!:     HTMLElement
  private barIndicator!: HTMLElement
  private bar1El!:       HTMLElement
  private bar2El!:       HTMLElement

  // [barIndex 0|1][slotIndex 0-3]
  private slots:     HTMLElement[][] = [[], []]
  private cooldowns: HTMLElement[][] = [[], []]
  private names:     HTMLElement[][] = [[], []]
  private costs:     HTMLElement[][] = [[], []]

  init(): void {
    this.hpFill       = document.getElementById('hp-fill')!
    this.manaFill     = document.getElementById('mana-fill')!
    this.barIndicator = document.getElementById('bar-indicator')!
    this.bar1El       = document.getElementById('bar-1')!
    this.bar2El       = document.getElementById('bar-2')!

    for (let i = 0; i < 4; i++) {
      this.slots[0].push(document.getElementById(`bar1-slot-${i}`)!)
      this.slots[1].push(document.getElementById(`bar2-slot-${i}`)!)
      this.cooldowns[0].push(document.getElementById(`bar1-cd-${i}`)!)
      this.cooldowns[1].push(document.getElementById(`bar2-cd-${i}`)!)
      this.names[0].push(document.getElementById(`bar1-name-${i}`)!)
      this.names[1].push(document.getElementById(`bar2-name-${i}`)!)
      this.costs[0].push(document.getElementById(`bar1-cost-${i}`)!)
      this.costs[1].push(document.getElementById(`bar2-cost-${i}`)!)
    }
  }

  update(player: Player, caster: SpellCaster, spellBar: SpellBar, currentTime: number): void {
    this.hpFill.style.width   = `${(player.hp   / player.maxHp)   * 100}%`
    this.manaFill.style.width = `${(player.mana  / player.maxMana) * 100}%`

    this.bar1El.className = 'spell-bar ' + (spellBar.activeBar === 1 ? 'active' : 'inactive')
    this.bar2El.className = 'spell-bar ' + (spellBar.activeBar === 2 ? 'active' : 'inactive')

    const barArrays = [spellBar.bar1, spellBar.bar2]
    for (let b = 0; b < 2; b++) {
      for (let s = 0; s < 4; s++) {
        const spell = barArrays[b][s]
        const slot  = this.slots[b][s]
        const cd    = this.cooldowns[b][s]
        const name  = this.names[b][s]
        const cost  = this.costs[b][s]

        if (!spell) {
          slot.removeAttribute('data-element')
          name.textContent = ''
          cost.textContent = ''
          cd.style.height  = '0%'
          cd.textContent   = ''
          continue
        }

        slot.dataset.element = spell.element
        name.textContent     = spell.name.substring(0, 9)
        cost.textContent     = `${spell.manaCost}MP`

        const pct       = caster.getCooldownPercent(spell.id, currentTime)
        const remaining = caster.getCooldownRemaining(spell.id, currentTime)
        cd.style.height = `${pct * 100}%`
        cd.textContent  = remaining > 0.05 ? remaining.toFixed(1) : ''
      }
    }
  }

  /** Flash the slot briefly green on successful cast. */
  onCastSuccess(barIndex: 0 | 1, slotIndex: number): void {
    const slot = this.slots[barIndex][slotIndex]
    slot.classList.remove('slot-flash')
    void (slot as HTMLElement).offsetWidth  // force reflow to restart animation
    slot.classList.add('slot-flash')
    setTimeout(() => slot.classList.remove('slot-flash'), 150)
  }

  /** Shake the slot to signal mana failure or cooldown. */
  onCastFail(barIndex: 0 | 1, slotIndex: number): void {
    const slot = this.slots[barIndex][slotIndex]
    slot.classList.remove('slot-shake')
    void (slot as HTMLElement).offsetWidth
    slot.classList.add('slot-shake')
    setTimeout(() => slot.classList.remove('slot-shake'), 200)
  }

  /** Pulse the bar indicator when the active bar changes. */
  onBarToggle(): void {
    this.barIndicator.classList.remove('pulse')
    void (this.barIndicator as HTMLElement).offsetWidth
    this.barIndicator.classList.add('pulse')
    setTimeout(() => this.barIndicator.classList.remove('pulse'), 500)
    this.barIndicator.textContent = ''  // cleared then set in next update()
  }
}
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css src/ui/HUD.ts
git commit -m "feat: dual spell bar HUD with cooldown sweeps, element tints, flash and shake animations"
```

---

## Task 10: Game.ts — wire everything together

**Files:**
- Modify: `src/core/Game.ts`

This task connects all Phase 2 systems. No unit test — verified by playing the game and checking all spells.

- [ ] **Step 1: Replace Game.ts**

```typescript
// src/core/Game.ts
import * as THREE        from 'three'
import { SceneManager }  from './SceneManager'
import { InputManager }  from './InputManager'
import { Room }          from '../dungeon/Room'
import { Player }        from '../entities/Player'
import { Enemy }         from '../entities/Enemy'
import { Projectile }    from '../entities/Projectile'
import { SpellCaster }   from '../spells/SpellCaster'
import { SpellBar }      from '../spells/SpellBar'
import { HUD }           from '../ui/HUD'
import {
  IEffect,
  castBlink,
  FrozenNovaEffect,
  IceWallEffect,
  ThunderClapEffect,
  ArcaneExplosionEffect,
  StaticFieldEffect,
  FrostDecalEffect,
  LightningBoltEffect,
} from '../spells/SpellEffects'
import { circleVsRect }  from '../utils/CollisionUtils'
import {
  DELTA_CAP,
  ENEMY_HALF_X,
  ENEMY_HALF_Z,
} from '../constants'
import { SPELLS } from '../spells/SpellDefinitions'

const SLOT_KEYS = ['KeyQ', 'KeyW', 'KeyE', 'KeyR'] as const

export class Game {
  private sceneManager: SceneManager
  private inputManager: InputManager
  private room:         Room
  private player:       Player
  private enemies:      Enemy[]
  private spellCaster:  SpellCaster
  private spellBar:     SpellBar
  private hud:          HUD
  private projectiles:  Projectile[]  = []
  private activeEffects: IEffect[]    = []
  private clock = new THREE.Clock()

  // Mouse-to-world projection
  private mouseWorld   = new THREE.Vector3()
  private floorPlane   = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private mouseRaycaster = new THREE.Raycaster()
  private mouseNDC     = new THREE.Vector2()

  constructor() {
    this.sceneManager = new SceneManager()
    this.inputManager = new InputManager()
    this.room         = new Room()
    this.player       = new Player()
    this.enemies      = [new Enemy(5, 5), new Enemy(-4, 3), new Enemy(2, -4)]
    this.spellCaster  = new SpellCaster(this.player)
    this.spellBar     = new SpellBar()
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

    const delta       = Math.min(this.clock.getDelta(), DELTA_CAP)
    const currentTime = this.clock.getElapsedTime()

    this.inputManager.update()
    this.player.update(delta, this.inputManager, this.room.bounds)

    // Project mouse NDC → world floor position
    this.mouseNDC.set(this.inputManager.mouseX, this.inputManager.mouseY)
    this.mouseRaycaster.setFromCamera(this.mouseNDC, this.sceneManager.camera)
    const hit = new THREE.Vector3()
    if (this.mouseRaycaster.ray.intersectPlane(this.floorPlane, hit)) {
      this.mouseWorld.copy(hit)
    }

    // Bar toggle
    if (this.inputManager.isJustPressed('Tab')) {
      this.spellBar.toggleBar()
      this.hud.onBarToggle()
    }

    // Spell casting: Q=0, W=1, E=2, R=3
    for (let slotIdx = 0; slotIdx < 4; slotIdx++) {
      if (this.inputManager.isJustPressed(SLOT_KEYS[slotIdx])) {
        this.attemptCast(slotIdx, currentTime)
      }
    }

    for (const enemy of this.enemies) {
      enemy.update(delta, this.player.position)
    }

    // Update homing targets for arcane_missile
    for (const proj of this.projectiles) {
      if (proj.spell.id === 'arcane_missile') {
        const target = this.nearestAliveEnemy(proj.mesh.position)
        proj.homingTarget = target?.position
      }
    }

    for (const proj of this.projectiles) {
      proj.update(delta, this.room.bounds, this.sceneManager.scene)
    }

    this.checkProjectileCollisions(currentTime)
    this.projectiles = this.projectiles.filter(p => p.alive)

    for (const effect of this.activeEffects) {
      effect.update(delta, this.sceneManager.scene, this.enemies)
    }
    this.activeEffects = this.activeEffects.filter(e => e.alive)

    this.hud.update(this.player, this.spellCaster, this.spellBar, currentTime)
    this.sceneManager.render()
  }

  private attemptCast(slotIdx: number, currentTime: number): void {
    const spell = this.spellBar.getSpellAtSlot(slotIdx as 0 | 1 | 2 | 3)
    if (!spell) return

    // Direction: mouse cursor position relative to player
    const mouseDir = new THREE.Vector3()
      .subVectors(this.mouseWorld, this.player.position)
      .setY(0)

    if (mouseDir.lengthSq() < 0.001) {
      mouseDir.copy(this.player.lastDirection)
    } else {
      mouseDir.normalize()
    }

    const aliveEnemies = this.enemies.filter(e => e.alive)
    const result = this.spellCaster.cast(
      spell,
      this.player,
      aliveEnemies,
      this.sceneManager.scene,
      currentTime,
      mouseDir,
    )

    const barIndex = (this.spellBar.activeBar - 1) as 0 | 1
    if (!result.success) {
      this.hud.onCastFail(barIndex, slotIdx)
      return
    }

    this.hud.onCastSuccess(barIndex, slotIdx)

    if (result.projectile) {
      if (spell.id === 'chain_lightning') {
        result.projectile.jumpsRemaining = 3
      }
      this.projectiles.push(result.projectile)
      return
    }

    // Handle non-projectile spells
    if (result.spellId) {
      this.handleSpecialSpell(result.spellId, mouseDir)
    }
  }

  private handleSpecialSpell(spellId: string, direction: THREE.Vector3): void {
    const scene   = this.sceneManager.scene
    const pos     = this.player.position.clone()
    const enemies = this.enemies.filter(e => e.alive)

    switch (spellId) {
      case 'blink':
        castBlink(this.player.position, this.player.mesh, this.player.lastDirection)
        break

      case 'frozen_nova':
        this.activeEffects.push(
          new FrozenNovaEffect(pos, enemies, SPELLS.frozen_nova.damage, scene),
        )
        break

      case 'ice_wall':
        this.activeEffects.push(new IceWallEffect(pos, direction, scene))
        break

      case 'thunder_clap':
        this.activeEffects.push(
          new ThunderClapEffect(pos, enemies, SPELLS.thunder_clap.damage, SPELLS.thunder_clap.radius ?? 5, scene),
        )
        break

      case 'arcane_explosion':
        this.activeEffects.push(
          new ArcaneExplosionEffect(pos, enemies, SPELLS.arcane_explosion.damage, SPELLS.arcane_explosion.radius ?? 6, scene),
        )
        break

      case 'static_field': {
        const targetPos = this.mouseWorld.clone()
        this.activeEffects.push(new StaticFieldEffect(targetPos, scene))
        break
      }

      case 'mana_siphon': {
        // Beam: deal damage to nearest enemy and restore some mana
        const nearest = this.nearestAliveEnemy(this.player.position)
        if (nearest && this.player.position.distanceTo(nearest.position) <= (SPELLS.mana_siphon.range ?? 8)) {
          nearest.takeDamage(SPELLS.mana_siphon.damage, scene)
          this.player.mana = Math.min(this.player.maxMana, this.player.mana + 15)
        }
        break
      }
    }
  }

  private checkProjectileCollisions(currentTime: number): void {
    for (const proj of this.projectiles) {
      if (!proj.alive) continue

      for (const enemy of this.enemies) {
        if (!enemy.alive) continue

        const projRadius = Math.max(
          proj.spell.projectileScale.x,
          proj.spell.projectileScale.z,
        ) * 0.5

        const hit = circleVsRect(
          proj.mesh.position.x, proj.mesh.position.z,
          projRadius,
          enemy.position.x - ENEMY_HALF_X,
          enemy.position.x + ENEMY_HALF_X,
          enemy.position.z - ENEMY_HALF_Z,
          enemy.position.z + ENEMY_HALF_Z,
        )

        if (!hit) continue

        // AOE on impact (e.g. Pyroblast)
        if (proj.spell.radius && proj.spell.radius > 0) {
          const r2 = proj.spell.radius * proj.spell.radius
          const impactPos = proj.mesh.position.clone()
          for (const other of this.enemies) {
            if (!other.alive) continue
            const dx = other.position.x - impactPos.x
            const dz = other.position.z - impactPos.z
            if (dx * dx + dz * dz <= r2) {
              other.takeDamage(proj.damage, this.sceneManager.scene)
            }
          }
        } else {
          enemy.takeDamage(proj.damage, this.sceneManager.scene)
        }

        // Ice impact frost decal
        if (proj.spell.element === 'ice') {
          this.activeEffects.push(
            new FrostDecalEffect(proj.mesh.position.clone(), this.sceneManager.scene),
          )
        }

        // Chain lightning: jump to next enemy
        if (proj.spell.id === 'chain_lightning' && proj.jumpsRemaining > 0) {
          const nextTarget = this.findChainTarget(enemy, this.enemies)
          if (nextTarget) {
            const from = proj.mesh.position.clone()
            const to   = nextTarget.position.clone()
            this.activeEffects.push(
              new LightningBoltEffect(from, to, this.sceneManager.scene),
            )
            const jumpDir = new THREE.Vector3()
              .subVectors(to, from)
              .setY(0)
              .normalize()
            const jumpProj = new Projectile(
              from.setY(0.75),
              jumpDir,
              proj.spell,
              this.sceneManager.scene,
              proj.jumpsRemaining - 1,
            )
            this.projectiles.push(jumpProj)
          }
        }

        proj.destroy(this.sceneManager.scene)
        break
      }
    }
  }

  private findChainTarget(hitEnemy: Enemy, allEnemies: Enemy[]): Enemy | null {
    const jumpRange = 6
    let nearest: Enemy | null = null
    let minDist = Infinity
    for (const e of allEnemies) {
      if (!e.alive || e === hitEnemy) continue
      const d = hitEnemy.position.distanceTo(e.position)
      if (d < jumpRange && d < minDist) {
        minDist = d
        nearest = e
      }
    }
    return nearest
  }

  private nearestAliveEnemy(from: THREE.Vector3): Enemy | null {
    let nearest: Enemy | null = null
    let minDist = Infinity
    for (const e of this.enemies) {
      if (!e.alive) continue
      const d = from.distanceTo(e.position)
      if (d < minDist) { minDist = d; nearest = e }
    }
    return nearest
  }
}
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 3: Start the dev server and verify the game runs**

```bash
npm run dev
```

Open the browser. Verify:
1. Game renders without console errors
2. HP and mana bars visible top-left
3. Two spell bars visible bottom-center, Bar 1 active (full opacity), Bar 2 dimmed
4. Bar indicator shows "BAR 1 / TAB"

- [ ] **Step 4: Test Tab bar switching**

- Press Tab → Bar 2 becomes full opacity, Bar 1 dims; indicator pulses and shows "BAR 2"
- Press Tab again → Bar 1 reactivates

- [ ] **Step 5: Test Q/W/E/R casting from Bar 1**

Move mouse to aim at enemy. Press Q (Fireball) — orange sphere projectile with orange glow and trail should fly toward mouse direction. Press W (Frost Bolt) — blue cone projectile. Press E (Chain Lightning) — thin yellow cylinder. Press R (Arcane Missile) — purple sphere that curves toward the enemy.

- [ ] **Step 6: Test Tab + Q/W/E/R casting from Bar 2**

Press Tab, then Q (Ember Shot) — small fast yellow-orange sphere. W (Glacial Spike) — blue elongated spike. E (Spark) — tiny bright yellow sphere, very fast. R (Blink) — player teleports 5 units forward with white flash.

- [ ] **Step 7: Verify cooldown UI**

Cast Fireball (Q, Bar 1). Observe: the Q slot shows a dark overlay draining from full height to 0 over 1.5 seconds. Mana drops by 20 and regenerates at 8/sec.

- [ ] **Step 8: Verify cast-fail feedback**

Drain mana to near 0 (spam Fireball). Try to cast when mana is too low — the Q slot should shake briefly.

- [ ] **Step 9: Commit**

```bash
git add src/core/Game.ts
git commit -m "feat: wire Phase 2 spell system — SpellBar, mouse casting, special effects, chain lightning, frost decals"
```

---

## Self-Review Checklist

**Spec coverage:**

| Requirement | Task |
|---|---|
| All 16 spells defined in SpellDefinitions.ts | Task 1 |
| Tab switches between Bar 1 and Bar 2 with HUD feedback | Tasks 2, 9, 10 |
| Q/W/E/R casts correct spell from active bar | Task 10 |
| Each spell has visually distinct projectile with glow and trail | Tasks 6, 7 |
| Blink special behavior | Tasks 8, 10 |
| Frozen Nova special behavior | Tasks 8, 10 |
| Ice Wall special behavior | Tasks 8, 10 |
| Chain Lightning jump behavior | Tasks 8, 10 |
| Arcane Missile homing | Tasks 7, 10 |
| Thunder Clap AOE | Tasks 8, 10 |
| Mana tracked, deducted, regenerates | Tasks 3, 5 |
| Cooldowns enforced and visualized | Tasks 5, 9 |
| Spells fire toward mouse cursor | Task 10 |
| HUD dual-bar with cooldown overlays, mana cost, element tints | Task 9 |
| Fire spells wobble; ice slow + frost decal; lightning spin; arcane rotate | Task 7 |
| Static Field persistent zone | Tasks 8, 10 |
| Arcane Explosion instant large AOE | Tasks 8, 10 |
| Mana Siphon beam | Task 10 |
| Pyroblast AOE radius on impact | Task 10 |

**Type consistency check:**
- `Spell` interface in SpellDefinitions.ts — used in SpellBar.ts, SpellCaster.ts, Projectile.ts, SpellEffects.ts ✓
- `CastResult` interface defined in SpellCaster.ts — used in Game.ts ✓
- `IEffect` interface defined in SpellEffects.ts — used in Game.ts as `activeEffects: IEffect[]` ✓
- `SpellCaster.getCooldownPercent(spellId, currentTime)` — called identically in HUD.ts ✓
- `HUD.update(player, caster, spellBar, currentTime)` — called identically in Game.ts loop ✓
- `Projectile` constructor `(origin, direction, spell, scene, jumpsRemaining?)` — called identically in SpellCaster.ts and Game.ts chain lightning jump ✓

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-18-phase2-spell-system.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans with checkpoints

**Which approach?**
