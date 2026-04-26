import { describe, it, expect, beforeEach } from 'vitest'
import { AudioStore } from '../src/audio/AudioStore'

describe('AudioStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when localStorage is empty', () => {
    const store = new AudioStore()
    expect(store.master).toBe(0.8)
    expect(store.music).toBe(0.8)
    expect(store.sfx).toBe(0.9)
    expect(store.muted).toBe(false)
  })

  it('persists changes and reloads them on next construction', () => {
    const a = new AudioStore()
    a.master = 0.5
    a.music = 0.4
    a.sfx = 0.7
    a.muted = true

    const b = new AudioStore()
    expect(b.master).toBe(0.5)
    expect(b.music).toBe(0.4)
    expect(b.sfx).toBe(0.7)
    expect(b.muted).toBe(true)
  })

  it('clamps values to [0, 1]', () => {
    const s = new AudioStore()
    s.master = -0.5
    expect(s.master).toBe(0)
    s.music = 2.0
    expect(s.music).toBe(1)
  })

  it('survives corrupt JSON in localStorage', () => {
    localStorage.setItem('arcanum.audio', '{not valid json')
    const s = new AudioStore()
    expect(s.master).toBe(0.8)
  })
})
