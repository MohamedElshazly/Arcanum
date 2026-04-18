export class InputManager {
  private held           = new Set<string>()
  private pendingPressed  = new Set<string>()
  private pendingReleased = new Set<string>()
  private _justPressed    = new Set<string>()
  private _justReleased   = new Set<string>()

  /** Normalised Device Coordinates of the mouse, updated on mousemove. */
  mouseX = 0
  mouseY = 0

  private onKeyDown = (e: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(e.key)) {
      e.preventDefault()
    }
    if (!this.held.has(e.code)) {
      this.pendingPressed.add(e.code)
    }
    this.held.add(e.code)
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code)
    this.pendingReleased.add(e.code)
  }

  private onMouseMove = (e: MouseEvent): void => {
    const canvas = document.querySelector('#game-canvas canvas') as HTMLCanvasElement | null
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    this.mouseX = ((e.clientX - rect.left) / rect.width)  * 2 - 1
    this.mouseY = -((e.clientY - rect.top)  / rect.height) * 2 + 1
  }

  constructor() {
    window.addEventListener('keydown',    this.onKeyDown)
    window.addEventListener('keyup',      this.onKeyUp)
    window.addEventListener('mousemove',  this.onMouseMove)
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
  }
}
