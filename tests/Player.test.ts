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
