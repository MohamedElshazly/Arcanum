import type { Audio } from '../audio'

export class AudioPanel {
  readonly element: HTMLDivElement

  constructor(audio: Audio) {
    this.element = document.createElement('div')
    this.element.className = 'audio-panel'
    this.element.innerHTML = `
      <h3>Audio</h3>
      <label>Master <input type="range" min="0" max="1" step="0.05" data-audio="master"></label>
      <label>Music  <input type="range" min="0" max="1" step="0.05" data-audio="music"></label>
      <label>SFX    <input type="range" min="0" max="1" step="0.05" data-audio="sfx"></label>
      <label><input type="checkbox" data-audio="muted"> Mute</label>
    `

    const setSlider = (key: 'master' | 'music' | 'sfx') => {
      const el = this.element.querySelector<HTMLInputElement>(`input[data-audio="${key}"]`)!
      el.value = String(audio.store[key])
      el.addEventListener('input', () => {
        audio.store[key] = Number(el.value)
        audio.music.applyVolume()
      })
    }
    setSlider('master')
    setSlider('music')
    setSlider('sfx')

    const muteEl = this.element.querySelector<HTMLInputElement>('input[data-audio="muted"]')!
    muteEl.checked = audio.store.muted
    muteEl.addEventListener('change', () => {
      audio.store.muted = muteEl.checked
      audio.music.applyVolume()
    })
  }
}
