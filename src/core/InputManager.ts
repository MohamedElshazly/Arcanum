export class InputManager {
  private held           = new Set<string>()
  private pendingPressed  = new Set<string>()
  private pendingReleased = new Set<string>()
  private _justPressed    = new Set<string>()
  private _justReleased   = new Set<string>()

  /** Normalised Device Coordinates of the mouse, updated on mousemove. */
  mouseX = 0
  mouseY = 0

  private _wheelDelta = 0

  /**
   * Maps physical key codes to logical key codes understood by the rest of
   * the game. WASD → Arrow codes (Player.ts), Digit1-4 → KeyQ/W/E/R (Game.ts).
   */
  private readonly keyMap: Record<string, string> = {
    'KeyW': 'ArrowUp',
    'KeyA': 'ArrowLeft',
    'KeyS': 'ArrowDown',
    'KeyD': 'ArrowRight',
    'Digit1': 'KeyQ',
    'Digit2': 'KeyE',
    'Digit3': 'KeyR',
    'Digit4': 'KeyF',
  }

  // Raw arrow keys blocked (WASD remaps to arrows above); everything else passes through.
  private readonly ignoredKeys = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  ])

  private onKeyDown = (e: KeyboardEvent): void => {
    if ([' ', 'Tab'].includes(e.key)) e.preventDefault()

    let code: string
    if (this.keyMap[e.code] !== undefined) {
      code = this.keyMap[e.code]          // remap physical key to logical code
    } else if (this.ignoredKeys.has(e.code)) {
      return                              // block raw legacy keys
    } else {
      code = e.code
    }

    if (!this.held.has(code)) {
      this.pendingPressed.add(code)
    }
    this.held.add(code)
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    let code: string
    if (this.keyMap[e.code] !== undefined) {
      code = this.keyMap[e.code]
    } else if (this.ignoredKeys.has(e.code)) {
      return
    } else {
      code = e.code
    }
    this.held.delete(code)
    this.pendingReleased.add(code)
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    this._wheelDelta += e.deltaY * 0.003
  }

  private onMouseMove = (e: MouseEvent): void => {
    const canvas = document.querySelector('#game-canvas canvas') as HTMLCanvasElement | null
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    this.mouseX = ((e.clientX - rect.left) / rect.width)  * 2 - 1
    this.mouseY = -((e.clientY - rect.top)  / rect.height) * 2 + 1
  }

  constructor() {
    window.addEventListener('keydown',   this.onKeyDown)
    window.addEventListener('keyup',     this.onKeyUp)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('wheel',     this.onWheel, { passive: false })
  }

  /** Returns accumulated scroll delta in radians and resets it. */
  consumeWheelDelta(): number {
    const d = this._wheelDelta
    this._wheelDelta = 0
    return d
  }

  update(): void {
    this._justPressed  = new Set(this.pendingPressed)
    this._justReleased = new Set(this.pendingReleased)
    this.pendingPressed.clear()
    this.pendingReleased.clear()
  }

  isHeld(code: string):         boolean { return this.held.has(code) }
  isJustPressed(code: string):  boolean { return this._justPressed.has(code) }
  isJustReleased(code: string): boolean { return this._justReleased.has(code) }

  dispose(): void {
    window.removeEventListener('keydown',   this.onKeyDown)
    window.removeEventListener('keyup',     this.onKeyUp)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('wheel',     this.onWheel)
  }
}
