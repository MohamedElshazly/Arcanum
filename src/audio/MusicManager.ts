import type { AudioBackend, InstanceId } from './AudioBackend'
import type { AudioStore } from './AudioStore'
import { MUSIC_FILES, type TrackId } from './manifest'

interface ActiveTrack {
  track:      TrackId
  instance:   InstanceId
  baseVolume: number  // before master/music multiplication
}

interface Fade {
  outgoing?: { active: ActiveTrack; targetVolume: number }
  incoming?: { active: ActiveTrack; targetVolume: number }
  elapsed:   number
  duration:  number
}

const fileId = (track: TrackId) => `music:${track}`

export class MusicManager {
  private current: ActiveTrack | null = null
  private fade:    Fade | null        = null
  private unlocked = false
  private pending: TrackId | null     = null

  constructor(
    private readonly backend: AudioBackend,
    private readonly store:   AudioStore,
  ) {}

  // ── Loading ─────────────────────────────────────────────────────────

  async preload(tracks: TrackId[]): Promise<void> {
    await Promise.all(tracks.map(t => this.backend.load(fileId(t), MUSIC_FILES[t])))
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  async unlock(): Promise<void> {
    if (this.unlocked) return
    await this.backend.unlock()
    this.unlocked = true
    if (this.pending) {
      const next = this.pending
      this.pending = null
      this.play(next)
    }
  }

  // ── Playback ────────────────────────────────────────────────────────

  /** Hard-cut to a track. */
  play(track: TrackId): void {
    if (!this.unlocked) {
      this.pending = track
      return
    }
    this.stopAllImmediately()
    const baseVolume = 1
    const instance = this.backend.play(fileId(track), { loop: true, volume: this.effectiveVolume(baseVolume) })
    this.current = { track, instance, baseVolume }
  }

  /** Fade current down while fading new up. */
  crossfadeTo(track: TrackId, duration: number): void {
    if (!this.unlocked) {
      this.pending = track
      return
    }
    if (this.current?.track === track) return  // already playing this track

    this.cancelFade()  // stop any in-flight fade so we don't leak instances

    const incomingInstance = this.backend.play(fileId(track), { loop: true, volume: 0 })
    const incoming: ActiveTrack = { track, instance: incomingInstance, baseVolume: 0 }

    this.fade = {
      outgoing: this.current ? { active: this.current, targetVolume: 0 } : undefined,
      incoming: { active: incoming, targetVolume: 1 },
      elapsed:  0,
      duration,
    }
    this.current = incoming
  }

  /** Fade current down, leave silence. */
  stopWithSilence(duration: number): void {
    if (!this.current) return
    this.fade = {
      outgoing: { active: this.current, targetVolume: 0 },
      elapsed:  0,
      duration,
    }
    this.current = null
  }

  // ── Per-frame tick ──────────────────────────────────────────────────

  update(delta: number): void {
    if (!this.fade) return
    this.fade.elapsed += delta
    const t = Math.min(1, this.fade.elapsed / this.fade.duration)

    if (this.fade.outgoing) {
      const start = this.fade.outgoing.active.baseVolume
      const next  = start + (this.fade.outgoing.targetVolume - start) * t
      this.fade.outgoing.active.baseVolume = next
      this.backend.setVolume(this.fade.outgoing.active.instance, this.effectiveVolume(next))
    }
    if (this.fade.incoming) {
      const next = this.fade.incoming.targetVolume * t
      this.fade.incoming.active.baseVolume = next
      this.backend.setVolume(this.fade.incoming.active.instance, this.effectiveVolume(next))
    }

    if (t >= 1) {
      if (this.fade.outgoing && this.fade.outgoing.targetVolume === 0) {
        this.backend.stop(this.fade.outgoing.active.instance)
      }
      this.fade = null
    }
  }

  // ── Volume ──────────────────────────────────────────────────────────

  /** Re-apply current volume after store changes. Public so AudioPanel can call it on slider input. */
  applyVolume(): void {
    if (this.fade?.outgoing) {
      this.backend.setVolume(this.fade.outgoing.active.instance, this.effectiveVolume(this.fade.outgoing.active.baseVolume))
    }
    if (this.current) {
      this.backend.setVolume(this.current.instance, this.effectiveVolume(this.current.baseVolume))
    }
  }

  // ── Internals ───────────────────────────────────────────────────────

  private effectiveVolume(base: number): number {
    if (this.store.muted) return 0
    return base * this.store.master * this.store.music
  }

  private stopAllImmediately(): void {
    const stopped = new Set<InstanceId>()
    const stop = (id: InstanceId) => {
      if (!stopped.has(id)) {
        this.backend.stop(id)
        stopped.add(id)
      }
    }
    if (this.current) stop(this.current.instance)
    if (this.fade?.outgoing) stop(this.fade.outgoing.active.instance)
    if (this.fade?.incoming) stop(this.fade.incoming.active.instance)
    this.current = null
    this.fade = null
  }

  /** Stop both sides of any in-progress fade. Caller is responsible for setting up the new state afterward. */
  private cancelFade(): void {
    if (!this.fade) return
    const stopped = new Set<InstanceId>()
    const stop = (id: InstanceId) => {
      if (!stopped.has(id)) {
        this.backend.stop(id)
        stopped.add(id)
      }
    }
    // Stop both sides of the in-progress fade EXCEPT the one that is also `this.current`
    // (the caller — e.g. crossfadeTo — preserves `this.current` so it can fade it out again).
    const currentInstance = this.current?.instance
    if (this.fade.outgoing && this.fade.outgoing.active.instance !== currentInstance) {
      stop(this.fade.outgoing.active.instance)
    }
    if (this.fade.incoming && this.fade.incoming.active.instance !== currentInstance) {
      stop(this.fade.incoming.active.instance)
    }
    this.fade = null
  }
}
