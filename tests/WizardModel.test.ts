import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { buildWizardModel, disposeWizardModel } from '../src/visuals/WizardModel'

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
