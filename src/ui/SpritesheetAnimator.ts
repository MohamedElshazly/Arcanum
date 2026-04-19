export interface SpritesheetConfig {
  imagePath:  string
  frameCount: number
  fps:        number
  loop:       boolean
  onComplete?: () => void
}

export class SpritesheetAnimator {
  private canvas:      HTMLCanvasElement
  private ctx:         CanvasRenderingContext2D
  private image:       HTMLImageElement | null = null
  private config:      SpritesheetConfig
  private currentFrame = 0
  private elapsed      = 0
  private playing      = false
  private loaded       = false
  private frameWidth   = 0
  private frameHeight  = 0

  constructor(canvas: HTMLCanvasElement, config: SpritesheetConfig) {
    this.canvas = canvas
    this.ctx    = canvas.getContext('2d')!
    this.config = config
    this.ctx.imageSmoothingEnabled = false
  }

  load(): Promise<void> {
    return new Promise((resolve, reject) => {
      const img   = new Image()
      img.onload  = () => {
        this.image       = img
        this.frameWidth  = img.naturalWidth / this.config.frameCount
        this.frameHeight = img.naturalHeight
        this.loaded      = true
        this.canvas.width  = this.frameWidth
        this.canvas.height = this.frameHeight
        this.ctx.imageSmoothingEnabled = false
        console.log(
          `[SpritesheetAnimator] Loaded ${this.config.imagePath}: ` +
          `${img.naturalWidth}×${img.naturalHeight}, ` +
          `${this.config.frameCount} frames, ` +
          `frameSize=${this.frameWidth}×${this.frameHeight}`,
        )
        resolve()
      }
      img.onerror = () => reject(new Error(`Failed to load spritesheet: ${this.config.imagePath}`))
      img.src     = this.config.imagePath
    })
  }

  play(): void {
    if (!this.loaded) return
    this.playing = true
  }

  stop(): void  { this.playing = false }

  reset(): void {
    this.currentFrame = 0
    this.elapsed      = 0
    this.playing      = false
    this.render()
  }

  update(delta: number): void {
    if (!this.playing || !this.loaded || !this.image) return

    this.elapsed += delta
    const frameDuration = 1 / this.config.fps

    while (this.elapsed >= frameDuration) {
      this.elapsed -= frameDuration
      this.currentFrame++

      if (this.currentFrame >= this.config.frameCount) {
        if (this.config.loop) {
          this.currentFrame = 0
        } else {
          this.currentFrame = this.config.frameCount - 1
          this.playing      = false
          this.config.onComplete?.()
          break
        }
      }
    }

    this.render()
  }

  private render(): void {
    if (!this.loaded || !this.image) return
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.drawImage(
      this.image,
      this.currentFrame * this.frameWidth, 0,
      this.frameWidth, this.frameHeight,
      0, 0,
      this.canvas.width, this.canvas.height,
    )
  }

  dispose(): void {
    this.playing = false
    this.loaded  = false
    this.image   = null
  }
}
