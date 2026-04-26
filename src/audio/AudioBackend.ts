/**
 * Minimal audio backend abstraction.
 * Production: HowlerAudioBackend (added in Task 8).
 * Tests:      FakeAudioBackend (in tests/FakeAudioBackend.ts).
 */

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
