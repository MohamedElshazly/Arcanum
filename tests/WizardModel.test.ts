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
