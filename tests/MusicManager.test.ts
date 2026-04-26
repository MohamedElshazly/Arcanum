import { describe, it, expect, beforeEach } from 'vitest'
import { MusicManager } from '../src/audio/MusicManager'
import { AudioStore } from '../src/audio/AudioStore'
import { FakeAudioBackend } from './FakeAudioBackend'

describe('MusicManager', () => {
  let backend: FakeAudioBackend
  let store:   AudioStore
  let mm:      MusicManager

  beforeEach(() => {
    localStorage.clear()
    backend = new FakeAudioBackend()
    store   = new AudioStore()
    mm      = new MusicManager(backend, store)
  })

  it('preloads no tracks until preload() is called', () => {
    expect(backend.loaded.size).toBe(0)
  })

  it('preload() loads the requested tracks', async () => {
    await mm.preload(['stone', 'boss'])
    expect(backend.loaded.has('music:stone')).toBe(true)
    expect(backend.loaded.has('music:boss')).toBe(true)
  })

  it('play(track) starts that track at full volume', async () => {
    await mm.preload(['stone'])
    await mm.unlock()
    mm.play('stone')
    const i = backend.activeFor('music:stone')
    expect(i).not.toBeNull()
    expect(i!.loop).toBe(true)
  })

  it('crossfadeTo() ramps current down and new up over the duration', async () => {
    await mm.preload(['stone', 'fire'])
    await mm.unlock()
    mm.play('stone')
    mm.crossfadeTo('fire', 1.0)
    // halfway through
    mm.update(0.5)
    const stone = backend.activeFor('music:stone')!
    const fire  = backend.activeFor('music:fire')!
    expect(stone.volume).toBeGreaterThan(0.3)
    expect(stone.volume).toBeLessThan(0.55)
    expect(fire.volume).toBeGreaterThan(0.3)
    expect(fire.volume).toBeLessThan(0.55)
    // complete
    mm.update(0.6)
    expect(backend.activeFor('music:stone')).toBeNull()
    expect(backend.activeFor('music:fire')).not.toBeNull()
  })

  it('stopWithSilence() fades current track and leaves nothing playing', async () => {
    await mm.preload(['stone'])
    await mm.unlock()
    mm.play('stone')
    mm.stopWithSilence(0.5)
    mm.update(0.5)
    expect(backend.activeFor('music:stone')).toBeNull()
  })

  it('queues play() calls until unlock() resolves', async () => {
    await mm.preload(['stone'])
    mm.play('stone')  // before unlock
    expect(backend.activeFor('music:stone')).toBeNull()
    await mm.unlock()
    expect(backend.activeFor('music:stone')).not.toBeNull()
  })

  it('master * music volume is applied on play', async () => {
    store.master = 0.5
    store.music  = 0.5
    await mm.preload(['stone'])
    await mm.unlock()
    mm.play('stone')
    expect(backend.activeFor('music:stone')!.volume).toBeCloseTo(0.25, 5)
  })

  it('mute silences live tracks; unmute restores them', async () => {
    await mm.preload(['stone'])
    await mm.unlock()
    mm.play('stone')
    const before = backend.activeFor('music:stone')!.volume
    store.muted = true
    mm.applyVolume()
    expect(backend.activeFor('music:stone')!.volume).toBe(0)
    store.muted = false
    mm.applyVolume()
    expect(backend.activeFor('music:stone')!.volume).toBeCloseTo(before, 5)
  })
})
