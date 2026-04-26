export interface TitleScreenConfig {
  root:    HTMLElement
  onBegin: () => void
}

const KEYBOARD_HTML = `
  <div class="ts-keyboard">
    <div class="ts-kb-rows">
      <div class="ts-kb-row">
        <div class="ts-key cast">Q</div>
        <div class="ts-key move">W</div>
        <div class="ts-key cast">E</div>
        <div class="ts-key cast">R</div>
        <div class="ts-key dim">T</div>
      </div>
      <div class="ts-kb-row" style="padding-left: 0.7vw">
        <div class="ts-key move">A</div>
        <div class="ts-key move">S</div>
        <div class="ts-key move">D</div>
        <div class="ts-key cast">F</div>
        <div class="ts-key dim">G</div>
      </div>
    </div>
    <div class="ts-kb-stack">
      <div class="ts-key heal ts-key-shift">SHIFT</div>
      <div class="ts-key dodge ts-key-space">SPACE</div>
    </div>
    <div class="ts-mouse-wrap">
      <div class="ts-mouse"><div class="ts-mouse-wheel"></div></div>
      <div class="ts-mouse-label">AIM</div>
    </div>
  </div>
`

const LEGEND_HTML = `
  <div class="ts-legend">
    <span><span class="ts-dot move"></span>MOVE</span>
    <span><span class="ts-dot cast"></span>CAST SPELL</span>
    <span><span class="ts-dot heal"></span>HEAL</span>
    <span><span class="ts-dot dodge"></span>DODGE</span>
  </div>
`

export class TitleScreen {
  private root:    HTMLElement
  private onBegin: () => void
  private element: HTMLDivElement | null = null
  private keyHandler: ((e: KeyboardEvent) => void) | null = null

  constructor(config: TitleScreenConfig) {
    this.root    = config.root
    this.onBegin = config.onBegin
  }

  show(): void {
    if (this.element) return
    const overlay = document.createElement('div')
    overlay.className = 'title-screen'
    overlay.innerHTML = `
      <div class="ts-glow ts-glow-1"></div>
      <div class="ts-glow ts-glow-2"></div>
      <div class="ts-glow ts-glow-3"></div>

      <div class="ts-title-block">
        <h1 class="ts-title">ARCANUM</h1>
        <div class="ts-tagline">— A Wizard Roguelike —</div>
      </div>

      ${KEYBOARD_HTML}
      ${LEGEND_HTML}

      <div class="ts-objective">
        Descend the dungeon. Master the four elements. Defeat the three Archmagi.
      </div>

      <button class="ts-begin" type="button">BEGIN</button>
      <div class="ts-hint">Press <span>ENTER</span> or click to begin</div>
    `

    overlay.querySelector<HTMLButtonElement>('.ts-begin')!.addEventListener('click', () => this.fire())

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        this.fire()
      }
    }
    window.addEventListener('keydown', this.keyHandler)

    this.root.appendChild(overlay)
    this.element = overlay
  }

  dispose(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler)
      this.keyHandler = null
    }
    if (this.element) {
      this.element.classList.add('ts-fading')
      const el = this.element
      this.element = null
      setTimeout(() => el.remove(), 350)
    }
  }

  private fired = false
  private fire(): void {
    if (this.fired) return
    this.fired = true
    this.onBegin()
  }
}
