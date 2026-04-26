import type { AudioBackend } from './AudioBackend'
import type { AudioStore } from './AudioStore'
import type { SpellElement } from '../spells/SpellDefinitions'
import { ALL_SFX_FILES, sfxFile, type SfxPhase } from './manifest'

const fileId = (publicPath: string) => 'sfx:' + publicPath.split('/').pop()!.replace('.ogg', '')

export class SfxManager {
  constructor(
    private readonly backend: AudioBackend,
    private readonly store:   AudioStore,
  ) {}

  async preloadAll(): Promise<void> {
    await Promise.all(ALL_SFX_FILES.map(src => this.backend.load(fileId(src), src)))
  }

  play(element: SpellElement, phase: SfxPhase): void {
    const src = sfxFile(element, phase)
    this.backend.play(fileId(src), { loop: false, volume: this.effectiveVolume() })
  }

  private effectiveVolume(): number {
    if (this.store.muted) return 0
    return this.store.master * this.store.sfx
  }
}
