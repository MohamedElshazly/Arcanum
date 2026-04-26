import type { AudioBackend, InstanceId, PlayOpts } from '../src/audio/AudioBackend'

interface FakeInstance {
  id:        InstanceId
  fileId:    string
  volume:    number
  loop:      boolean
  playing:   boolean
}

export class FakeAudioBackend implements AudioBackend {
  loaded:    Set<string>           = new Set()
  instances: Map<InstanceId, FakeInstance> = new Map()
  unlocked   = false
  private nextId: InstanceId = 1

  async load(id: string, _src: string): Promise<void> {
    this.loaded.add(id)
  }

  play(id: string, opts: PlayOpts = {}): InstanceId {
    const instance: FakeInstance = {
      id:      this.nextId++,
      fileId:  id,
      volume:  opts.volume ?? 1,
      loop:    opts.loop ?? false,
      playing: true,
    }
    this.instances.set(instance.id, instance)
    return instance.id
  }

  stop(instance: InstanceId): void {
    const i = this.instances.get(instance)
    if (i) i.playing = false
  }

  setVolume(instance: InstanceId, volume: number): void {
    const i = this.instances.get(instance)
    if (i) i.volume = volume
  }

  async unlock(): Promise<void> {
    this.unlocked = true
  }

  // Test helpers ──────────────────────────────────────────────────────

  /** Return all currently-playing instances. */
  active(): FakeInstance[] {
    return [...this.instances.values()].filter(i => i.playing)
  }

  /** Find the active instance for a given file id, or null. */
  activeFor(fileId: string): FakeInstance | null {
    return this.active().find(i => i.fileId === fileId) ?? null
  }
}
