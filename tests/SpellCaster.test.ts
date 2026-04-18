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
    ;(caster as any).cooldowns.set('fireball', 0)
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
    caster.cast(SPELLS.fireball, entity, [], scene, 0, dir)
    const result = caster.cast(SPELLS.fireball, entity, [], scene, 0.1, dir)
    expect(result.success).toBe(false)
    expect(result.failReason).toBe('on_cooldown')
  })
})
