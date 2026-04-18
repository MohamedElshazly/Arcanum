import * as THREE   from 'three'
import { SceneManager } from './SceneManager'
import { InputManager } from './InputManager'
import { Room }         from '../dungeon/Room'
import { Player }       from '../entities/Player'
import { Enemy }        from '../entities/Enemy'
import { Projectile }   from '../entities/Projectile'
import { SpellCaster }  from '../spells/SpellCaster'
import { HUD }          from '../ui/HUD'
import { circleVsRect } from '../utils/CollisionUtils'
import { DELTA_CAP, ENEMY_HALF_X, ENEMY_HALF_Z } from '../constants'

export class Game {
  private sceneManager: SceneManager
  private inputManager: InputManager
  private room:         Room
  private player:       Player
  private enemies:      Enemy[]
  private spellCaster:  SpellCaster
  private hud:          HUD
  private projectiles:  Projectile[] = []
  private clock = new THREE.Clock()

  constructor() {
    this.sceneManager = new SceneManager()
    this.inputManager = new InputManager()
    this.room         = new Room()
    this.player       = new Player()
    this.enemies      = [new Enemy(5, 5)]
    this.spellCaster  = new SpellCaster(this.player)
    this.hud          = new HUD()
  }

  start(): void {
    this.room.build(this.sceneManager.scene)
    this.sceneManager.scene.add(this.player.mesh)
    for (const enemy of this.enemies) {
      this.sceneManager.scene.add(enemy.mesh)
    }
    this.hud.init()
    this.clock.start()
    requestAnimationFrame(this.loop)
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop)
    const delta = Math.min(this.clock.getDelta(), DELTA_CAP)

    this.inputManager.update()
    this.player.update(delta, this.inputManager, this.room.bounds)
    this.spellCaster.update(delta)

    if (this.inputManager.isJustPressed('KeyQ')) {
      this.castFireball()
    }

    for (const enemy of this.enemies) {
      enemy.update(delta, this.player.position)
    }

    for (const proj of this.projectiles) {
      proj.update(delta, this.room.bounds, this.sceneManager.scene)
    }

    this.checkProjectileCollisions()
    this.projectiles = this.projectiles.filter(p => p.alive)

    this.hud.update(this.player, this.spellCaster)
    this.sceneManager.render()
  }

  private castFireball(): void {
    const living = this.enemies.filter(e => e.alive)
    const dir    = this.getDirectionToNearest(living)
    const origin = this.player.position.clone().setY(0.75)
    const proj   = this.spellCaster.cast('fireball', origin, dir, this.sceneManager.scene)
    if (proj) this.projectiles.push(proj)
  }

  private getDirectionToNearest(enemies: Enemy[]): THREE.Vector3 {
    if (enemies.length === 0) return this.player.lastDirection.clone()

    let nearest = enemies[0]
    let minDist = this.player.position.distanceTo(nearest.position)
    for (let i = 1; i < enemies.length; i++) {
      const d = this.player.position.distanceTo(enemies[i].position)
      if (d < minDist) { minDist = d; nearest = enemies[i] }
    }
    return new THREE.Vector3()
      .subVectors(nearest.position, this.player.position)
      .setY(0)
      .normalize()
  }

  private checkProjectileCollisions(): void {
    for (const proj of this.projectiles) {
      if (!proj.alive) continue
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue
        const hit = circleVsRect(
          proj.mesh.position.x, proj.mesh.position.z,
          proj.damage > 0 ? 0.2 : 0,   // projectile radius (FIREBALL_RADIUS)
          enemy.position.x - ENEMY_HALF_X,
          enemy.position.x + ENEMY_HALF_X,
          enemy.position.z - ENEMY_HALF_Z,
          enemy.position.z + ENEMY_HALF_Z,
        )
        if (hit) {
          enemy.takeDamage(proj.damage, this.sceneManager.scene)
          proj.destroy(this.sceneManager.scene)
          break // one projectile hits one enemy
        }
      }
    }
  }
}
