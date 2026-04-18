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
