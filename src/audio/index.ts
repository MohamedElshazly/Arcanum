import { AudioStore } from './AudioStore'
import { MusicManager } from './MusicManager'
import { SfxManager } from './SfxManager'
import { HowlerAudioBackend, type AudioBackend } from './AudioBackend'

export interface Audio {
  store: AudioStore
  music: MusicManager
  sfx:   SfxManager
}

/** Create the audio system. Pass a custom backend in tests. */
export function createAudio(backend: AudioBackend = new HowlerAudioBackend()): Audio {
  const store = new AudioStore()
  const music = new MusicManager(backend, store)
  const sfx   = new SfxManager(backend, store)
  return { store, music, sfx }
}

export type { TrackId } from './manifest'
export { AudioStore }
export { MusicManager }
export { SfxManager }
