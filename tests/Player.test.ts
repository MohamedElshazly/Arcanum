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

  it('setTint changes exactly one child mesh (the body) emissive', () => {
    const p = new Player()
    const meshes = p.mesh.children.filter(c => c instanceof THREE.Mesh) as THREE.Mesh[]
    const originals = meshes.map(m => (m.material as THREE.MeshStandardMaterial).emissive.getHex())

    p.setTint(0x00ff00, 1)

    const tinted = meshes.filter(m => (m.material as THREE.MeshStandardMaterial).emissive.getHex() === 0x00ff00)
    expect(tinted.length).toBe(1)

    p.clearTint()

    for (let i = 0; i < meshes.length; i++) {
      expect((meshes[i].material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(originals[i])
    }
  })
})
