import * as THREE from 'three'
import { VIEW_WIDTH } from '../constants'

export class SceneManager {
  readonly scene       = new THREE.Scene()
  readonly renderer    = new THREE.WebGLRenderer({ antialias: true })
  readonly camera:     THREE.OrthographicCamera
  readonly ambientLight = new THREE.AmbientLight(0xffffff, 0.6)

  private _cameraAngle = 0
  private readonly CAM_RADIUS = 14
  private readonly CAM_HEIGHT = 20

  get angle(): number { return this._cameraAngle }

  constructor() {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    document.getElementById('game-canvas')!.appendChild(this.renderer.domElement)

    const aspect = window.innerWidth / window.innerHeight
    const hw     = VIEW_WIDTH / 2
    this.camera  = new THREE.OrthographicCamera(
      -hw, hw, hw / aspect, -hw / aspect, 0.1, 200
    )
    this.camera.position.set(0, 20, 14)
    this.camera.lookAt(0, 0, 0)

    const directional = new THREE.DirectionalLight(0xfff5e0, 0.8)
    directional.position.set(-10, 20, 10)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6)
    fillLight.position.set(5, 10, 5)
    this.scene.add(this.ambientLight, directional, fillLight)

    window.addEventListener('resize', this.onResize)
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  /** Position camera above playerPos at the current orbit angle. Call every frame. */
  followPlayer(playerPos: THREE.Vector3): void {
    this.camera.position.set(
      playerPos.x + Math.sin(this._cameraAngle) * this.CAM_RADIUS,
      playerPos.y + this.CAM_HEIGHT,
      playerPos.z + Math.cos(this._cameraAngle) * this.CAM_RADIUS,
    )
    this.camera.lookAt(playerPos)
  }

  /** Rotate the orbit angle; followPlayer() applies the new position. */
  rotateCamera(dAngle: number): void {
    this._cameraAngle += dAngle
  }

  private onResize = (): void => {
    const aspect = window.innerWidth / window.innerHeight
    const hw     = VIEW_WIDTH / 2
    this.camera.left   = -hw
    this.camera.right  =  hw
    this.camera.top    =  hw / aspect
    this.camera.bottom = -hw / aspect
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }
}
