import { describe, it, expect, beforeEach } from 'vitest'
import { SfxManager } from '../src/audio/SfxManager'
import { AudioStore } from '../src/audio/AudioStore'
import { FakeAudioBackend } from './FakeAudioBackend'

describe('SfxManager', () => {
  let backend: FakeAudioBackend
  let store:   AudioStore
  let sfx:     SfxManager

  beforeEach(() => {
    localStorage.clear()
    backend = new FakeAudioBackend()
    store   = new AudioStore()
    sfx     = new SfxManager(backend, store)
  })

  it('preloadAll() loads every (element, phase) combo + utility', async () => {
    await sfx.preloadAll()
    expect(backend.loaded.has('sfx:fire_cast')).toBe(true)
    expect(backend.loaded.has('sfx:fire_impact')).toBe(true)
    expect(backend.loaded.has('sfx:ice_cast')).toBe(true)
    expect(backend.loaded.has('sfx:arcane_impact')).toBe(true)
    expect(backend.loaded.has('sfx:utility')).toBe(true)
    expect(backend.loaded.size).toBe(9)
  })

  it('play(element, "cast") fires the right file', async () => {
    await sfx.preloadAll()
    sfx.play('fire', 'cast')
    expect(backend.activeFor('sfx:fire_cast')).not.toBeNull()
  })

  it('play(any, "utility") fires the shared utility file', async () => {
    await sfx.preloadAll()
    sfx.play('ice', 'utility')
    expect(backend.activeFor('sfx:utility')).not.toBeNull()
  })

  it('master * sfx volume is applied', async () => {
    store.master = 0.5
    store.sfx    = 0.4
    await sfx.preloadAll()
    sfx.play('lightning', 'impact')
    expect(backend.activeFor('sfx:lightning_impact')!.volume).toBeCloseTo(0.2, 5)
  })

  it('mute drives volume to zero', async () => {
    store.muted = true
    await sfx.preloadAll()
    sfx.play('arcane', 'cast')
    expect(backend.activeFor('sfx:arcane_cast')!.volume).toBe(0)
  })

  it('overlapping calls produce independent instances', async () => {
    await sfx.preloadAll()
    sfx.play('fire', 'cast')
    sfx.play('fire', 'cast')
    sfx.play('fire', 'cast')
    const all = backend.active().filter(i => i.fileId === 'sfx:fire_cast')
    expect(all.length).toBe(3)
  })
})
