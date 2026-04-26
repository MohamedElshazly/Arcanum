const KEY = 'arcanum.audio'

interface Persisted {
  master: number
  music:  number
  sfx:    number
  muted:  boolean
}

const DEFAULTS: Persisted = { master: 0.8, music: 0.8, sfx: 0.9, muted: false }

const clamp = (v: number) => Math.max(0, Math.min(1, v))

export class AudioStore {
  private state: Persisted

  constructor() {
    this.state = this.load()
  }

  get master(): number { return this.state.master }
  set master(v: number) { this.state.master = clamp(v); this.save() }

  get music(): number { return this.state.music }
  set music(v: number) { this.state.music = clamp(v); this.save() }

  get sfx(): number { return this.state.sfx }
  set sfx(v: number) { this.state.sfx = clamp(v); this.save() }

  get muted(): boolean { return this.state.muted }
  set muted(v: boolean) { this.state.muted = v; this.save() }

  private load(): Persisted {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return { ...DEFAULTS }
      const parsed = JSON.parse(raw) as Partial<Persisted>
      return {
        master: typeof parsed.master === 'number' ? clamp(parsed.master) : DEFAULTS.master,
        music:  typeof parsed.music  === 'number' ? clamp(parsed.music)  : DEFAULTS.music,
        sfx:    typeof parsed.sfx    === 'number' ? clamp(parsed.sfx)    : DEFAULTS.sfx,
        muted:  typeof parsed.muted  === 'boolean' ? parsed.muted        : DEFAULTS.muted,
      }
    } catch {
      return { ...DEFAULTS }
    }
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state))
    } catch {
      // storage full / disabled — ignore, just don't persist
    }
  }
}
