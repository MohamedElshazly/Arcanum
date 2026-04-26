/**
 * Minimal audio backend abstraction.
 * Production: HowlerAudioBackend (added in Task 8).
 * Tests:      FakeAudioBackend (in tests/FakeAudioBackend.ts).
 */

import { Howl, Howler } from 'howler'

export type InstanceId = number

export interface PlayOpts {
  loop?:   boolean
  volume?: number  // 0..1
}

export interface AudioBackend {
  /** Preload an audio file under a stable id. Idempotent. */
  load(id: string, src: string): Promise<void>

  /** Begin playback. Returns an instance id for later stop/setVolume. */
  play(id: string, opts?: PlayOpts): InstanceId

  /** Stop a specific playing instance. No-op if already stopped. */
  stop(instance: InstanceId): void

  /** Set volume on a playing instance. */
  setVolume(instance: InstanceId, volume: number): void

  /** Resume the audio context (browser autoplay policy). */
  unlock(): Promise<void>
}

// ── Production Howler backend ───────────────────────────────────────

interface LoadedSound {
  howl: Howl
}

export class HowlerAudioBackend implements AudioBackend {
  private sounds: Map<string, LoadedSound> = new Map()
  private instanceMap: Map<InstanceId, { sound: LoadedSound; howlId: number }> = new Map()
  private nextId: InstanceId = 1

  load(id: string, src: string): Promise<void> {
    if (this.sounds.has(id)) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const howl = new Howl({
        src:    [src],
        preload: true,
        onload:    () => { this.sounds.set(id, { howl }); resolve() },
        onloaderror: (_id, err) => reject(new Error(`Failed to load ${src}: ${err}`)),
      })
    })
  }

  play(id: string, opts: PlayOpts = {}): InstanceId {
    const sound = this.sounds.get(id)
    if (!sound) throw new Error(`AudioBackend.play: id "${id}" not loaded`)
    sound.howl.loop(opts.loop ?? false)
    const howlId = sound.howl.play()
    sound.howl.volume(opts.volume ?? 1, howlId)
    const instance = this.nextId++
    this.instanceMap.set(instance, { sound, howlId })
    sound.howl.once('end', () => {
      if (!sound.howl.loop(howlId)) this.instanceMap.delete(instance)
    }, howlId)
    return instance
  }

  stop(instance: InstanceId): void {
    const m = this.instanceMap.get(instance)
    if (!m) return
    m.sound.howl.stop(m.howlId)
    this.instanceMap.delete(instance)
  }

  setVolume(instance: InstanceId, volume: number): void {
    const m = this.instanceMap.get(instance)
    if (!m) return
    m.sound.howl.volume(volume, m.howlId)
  }

  async unlock(): Promise<void> {
    if (Howler.ctx?.state === 'suspended') {
      await Howler.ctx.resume()
    }
  }
}
