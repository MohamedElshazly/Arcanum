import * as THREE from 'three'
import { VIEW_WIDTH } from '../constants'

export class SceneManager {
  readonly scene    = new THREE.Scene()
  readonly renderer = new THREE.WebGLRenderer({ antialias: true })
  readonly camera:  THREE.OrthographicCamera

  constructor() {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    document.getElementById('game-canvas')!.appendChild(this.renderer.domElement)

    const aspect = window.innerWidth / window.innerHeight
    const hw     = VIEW_WIDTH / 2
    this.camera  = new THREE.OrthographicCamera(
      -hw, hw, hw / aspect, -hw / aspect, 0.1, 200
    )
    // Isometric-style angle: ~55° pitch, 45° yaw
    this.camera.position.set(0, 20, 14)
    this.camera.lookAt(0, 0, 0)

    const ambient     = new THREE.AmbientLight(0xffffff, 0.6)
    const directional = new THREE.DirectionalLight(0xfff5e0, 0.8)
    directional.position.set(-10, 20, 10)
    this.scene.add(ambient, directional)

    window.addEventListener('resize', this.onResize)
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
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
