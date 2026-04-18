import * as THREE from 'three'

/**
 * Circular buffer of 8 ghost meshes that follow a moving object.
 * The newest ghost has opacity 0.53, oldest approaches 0.
 * All ghosts share one SphereGeometry; each has its own material.
 */
export class TrailSystem {
  private readonly ghosts:    THREE.Mesh[]
  private readonly positions: THREE.Vector3[]
  private readonly size = 8
  private head = 0
  private filled = 0

  constructor(color: string, scene: THREE.Scene) {
    const geo = new THREE.SphereGeometry(0.1, 4, 3)
    this.ghosts = Array.from({ length: this.size }, () => {
      const mat  = new THREE.MeshBasicMaterial({
        color:       new THREE.Color(color),
        transparent: true,
        opacity:     0,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      scene.add(mesh)
      return mesh
    })
    this.positions = Array.from({ length: this.size }, () => new THREE.Vector3())
  }

  /** Call once per frame with the projectile's current world position. */
  update(currentPosition: THREE.Vector3): void {
    this.positions[this.head].copy(currentPosition)
    this.head   = (this.head + 1) % this.size
    this.filled = Math.min(this.filled + 1, this.size)

    for (let i = 0; i < this.size; i++) {
      const posIdx   = (this.head - 1 - i + this.size) % this.size
      const ghost    = this.ghosts[posIdx]
      if (i >= this.filled) {
        ghost.visible = false
        continue
      }
      ghost.position.copy(this.positions[posIdx])
      ghost.visible = true
      ;(ghost.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, 0.6 * (1 - (i + 1) / (this.size + 1)))
    }
  }

  dispose(scene: THREE.Scene): void {
    const geo = this.ghosts[0]?.geometry
    for (const g of this.ghosts) {
      g.visible = false
      scene.remove(g)
      ;(g.material as THREE.MeshBasicMaterial).dispose()
    }
    geo?.dispose()
  }
}
