import * as THREE  from 'three'
import { SPELLS }  from '../spells/SpellDefinitions'
import { Projectile } from './Projectile'
import type { RoomBounds } from '../dungeon/Room'

export interface EnemyConfig {
  archetype: 'apprentice' | 'battle_mage'
  spellIds:  string[]
  x: number
  z: number
  depth: number
}

export interface ScaledStats {
  hp: number; speed: number; castInterval: number; spellCount: number
}

const BASE_HP:    Record<'apprentice' | 'battle_mage', number> = { apprentice: 40, battle_mage: 80 }
const BASE_SPEED: Record<'apprentice' | 'battle_mage', number> = { apprentice: 2.5, battle_mage: 1.8 }

export function scaleEnemyStats(
  archetype: 'apprentice' | 'battle_mage',
  depth: number,
): ScaledStats {
  const hpD    = Math.min(depth, 8)
  const speedD = Math.min(depth, 6)
  return {
    hp:           Math.round(BASE_HP[archetype]    * Math.pow(1.15, hpD)),
    speed:        BASE_SPEED[archetype] * Math.pow(1.05, speedD),
    castInterval: Math.max(0.8, 2.0 - depth * 0.1),
    spellCount:   depth <= 2 ? 2 : depth <= 4 ? 3 : 4,
  }
}

const ELEMENT_COLOR: Record<string, number> = {
  fire: 0xcc4400, ice: 0x4499cc, lightning: 0xcccc00, arcane: 0x9944cc,
}

interface BlinkTelegraph {
  timer:       number
  destination: THREE.Vector3
  originRing:  THREE.Mesh
  destRing:    THREE.Mesh
  line:        THREE.Line
}

export class Enemy {
  readonly mesh:     THREE.Mesh
  readonly position: THREE.Vector3
  hp:    number
  maxHp: number
  alive  = true

  private readonly stats:     ScaledStats
  private readonly archetype: 'apprentice' | 'battle_mage'
  private readonly depth:     number
  private spells = Object.values(SPELLS)
  private castTimer           = 0
  private aggressionRange:    number
  private telegraph:          BlinkTelegraph | null = null
  private ghostTimer          = 0
  private ghostMesh:          THREE.Mesh | null = null

  constructor(config: EnemyConfig) {
    this.archetype = config.archetype
    this.depth     = config.depth
    this.stats     = scaleEnemyStats(config.archetype, config.depth)
    this.hp        = this.stats.hp
    this.maxHp     = this.stats.hp

    this.aggressionRange = config.depth <= 2 ? 8 : config.depth <= 4 ? 12 : 9999

    this.spells = config.spellIds
      .map(id => SPELLS[id])
      .filter(Boolean)

    const isLarge = config.archetype === 'battle_mage'
    const geo     = new THREE.BoxGeometry(0.8, isLarge ? 1.8 : 1.2, 0.8)
    const color   = this.dominantColor()
    const mat     = new THREE.MeshStandardMaterial({ color })
    this.mesh     = new THREE.Mesh(geo, mat)
    this.mesh.position.set(config.x, isLarge ? 0.9 : 0.6, config.z)
    this.position = this.mesh.position

    this.castTimer = Math.random() * this.stats.castInterval
  }

  private dominantColor(): number {
    if (!this.spells.length) return 0x888888
    const el = this.spells[0].element
    return ELEMENT_COLOR[el] ?? 0x888888
  }

  update(
    delta: number,
    playerPos: THREE.Vector3,
    bounds: RoomBounds,
    scene: THREE.Scene,
  ): Projectile | null {
    if (!this.alive) return null

    if (this.ghostMesh) {
      this.ghostTimer -= delta
      const mat = this.ghostMesh.material as THREE.MeshStandardMaterial
      mat.opacity = Math.max(0, this.ghostTimer / 0.4)
      if (this.ghostTimer <= 0) { scene.remove(this.ghostMesh); this.ghostMesh = null }
    }

    if (this.telegraph) {
      this.telegraph.timer += delta
      if (this.telegraph.timer >= 0.6) {
        this.executeBlink(this.telegraph.destination, scene)
        this.clearTelegraph(scene)
      }
      return null
    }

    const dist = this.position.distanceTo(playerPos)
    const inRange = dist < this.aggressionRange

    if (!inRange) return null

    if (this.shouldBlink(playerPos, dist)) {
      const dest = this.blinkDestination(playerPos, bounds)
      if (dest) {
        this.startTelegraph(dest, scene)
        return null
      }
    }

    this.moveToward(delta, playerPos, dist)

    this.castTimer -= delta
    if (this.castTimer <= 0 && this.spells.length > 0) {
      this.castTimer = this.stats.castInterval
      return this.fireProjectile(playerPos, scene)
    }

    return null
  }

  private moveToward(delta: number, playerPos: THREE.Vector3, dist: number): void {
    if (this.archetype === 'battle_mage') {
      const targetDist = 8
      const tooClose   = dist < 6
      const dir = new THREE.Vector3().subVectors(playerPos, this.position).setY(0).normalize()
      if (tooClose) {
        this.position.x -= dir.x * this.stats.speed * delta
        this.position.z -= dir.z * this.stats.speed * delta
      } else if (dist > targetDist + 1) {
        this.position.x += dir.x * this.stats.speed * delta
        this.position.z += dir.z * this.stats.speed * delta
      }
      const perp = new THREE.Vector3(-dir.z, 0, dir.x)
      this.position.x += perp.x * this.stats.speed * 0.4 * delta
      this.position.z += perp.z * this.stats.speed * 0.4 * delta
    } else {
      if (dist > 0.5) {
        const dir = new THREE.Vector3().subVectors(playerPos, this.position).setY(0).normalize()
        this.position.x += dir.x * this.stats.speed * delta
        this.position.z += dir.z * this.stats.speed * delta
      }
    }
  }

  private shouldBlink(_playerPos: THREE.Vector3, dist: number): boolean {
    if (this.archetype === 'apprentice' && this.depth >= 5) {
      return this.hp / this.maxHp < 0.3
    }
    if (this.archetype === 'battle_mage' && this.depth >= 4) {
      return dist < 3
    }
    return false
  }

  private blinkDestination(playerPos: THREE.Vector3, bounds: RoomBounds): THREE.Vector3 | null {
    const away = new THREE.Vector3().subVectors(this.position, playerPos).setY(0).normalize()
    const dist = this.archetype === 'battle_mage' && this.depth >= 6 ? -6 : 6
    const dest = this.position.clone().addScaledVector(away, dist)
    dest.x = Math.max(bounds.minX + 1, Math.min(bounds.maxX - 1, dest.x))
    dest.z = Math.max(bounds.minZ + 1, Math.min(bounds.maxZ - 1, dest.z))
    return dest
  }

  private startTelegraph(dest: THREE.Vector3, scene: THREE.Scene): void {
    const ringGeo = new THREE.TorusGeometry(0.6, 0.05, 8, 32)
    const mat1 = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(0xffffff), emissiveIntensity: 2 })
    const mat2 = mat1.clone()

    const originRing = new THREE.Mesh(ringGeo, mat1)
    originRing.position.copy(this.position)
    originRing.rotation.x = Math.PI / 2

    const destRing = new THREE.Mesh(ringGeo.clone(), mat2)
    destRing.position.copy(dest)
    destRing.rotation.x = Math.PI / 2

    const points = [this.position.clone(), dest.clone()]
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true })
    const line    = new THREE.Line(lineGeo, lineMat)

    scene.add(originRing, destRing, line)
    this.telegraph = { timer: 0, destination: dest, originRing, destRing, line }
  }

  private executeBlink(dest: THREE.Vector3, scene: THREE.Scene): void {
    const ghostGeo = this.mesh.geometry.clone()
    const ghostMat = new THREE.MeshStandardMaterial({
      color: (this.mesh.material as THREE.MeshStandardMaterial).color.clone(),
      transparent: true, opacity: 0.8,
    })
    this.ghostMesh  = new THREE.Mesh(ghostGeo, ghostMat)
    this.ghostMesh.position.copy(this.position)
    scene.add(this.ghostMesh)
    this.ghostTimer = 0.4

    this.position.copy(dest)
  }

  private clearTelegraph(scene: THREE.Scene): void {
    if (!this.telegraph) return
    scene.remove(this.telegraph.originRing, this.telegraph.destRing, this.telegraph.line)
    this.telegraph = null
  }

  private fireProjectile(playerPos: THREE.Vector3, scene: THREE.Scene): Projectile | null {
    const castable = this.spells.filter(s => s.id !== 'blink' && s.type === 'projectile')
    if (!castable.length) return null
    const spell = castable[Math.floor(Math.random() * castable.length)]
    const dir   = new THREE.Vector3().subVectors(playerPos, this.position).setY(0).normalize()
    const origin = this.position.clone().setY(0.75)
    return new Projectile(origin, dir, spell, scene)
  }

  takeDamage(amount: number, scene: THREE.Scene): void {
    this.hp -= amount
    if (this.hp <= 0) this.die(scene)
  }

  private die(scene: THREE.Scene): void {
    this.alive = false
    this.clearTelegraph(scene)
    scene.remove(this.mesh)
  }
}
