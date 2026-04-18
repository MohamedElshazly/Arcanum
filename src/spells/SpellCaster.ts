import * as THREE from 'three'
import { SPELLS }     from './SpellDefinitions'
import { Projectile } from '../entities/Projectile'

export class SpellCaster {
  private cooldowns = new Map<string, number>()   // spellId → seconds remaining
  private manaSrc:  { mana: number }

  constructor(manaSrc: { mana: number }) {
    this.manaSrc = manaSrc
  }

  /** Tick all active cooldowns down by delta seconds. */
  update(delta: number): void {
    for (const [id, remaining] of this.cooldowns) {
      this.cooldowns.set(id, Math.max(0, remaining - delta))
    }
  }

  cast(
    spellId:   string,
    origin:    THREE.Vector3,
    direction: THREE.Vector3,
    scene:     THREE.Scene,
  ): Projectile | null {
    const spell = SPELLS[spellId]
    if (!spell || spell.type !== 'projectile' || spell.speed === undefined) return null
    if ((this.cooldowns.get(spellId) ?? 0) > 0) return null
    if (this.manaSrc.mana < spell.manaCost) return null

    this.manaSrc.mana -= spell.manaCost
    this.cooldowns.set(spellId, spell.cooldown)

    const proj = new Projectile(origin, direction, spell.speed, spell.range, spell.damage)
    scene.add(proj.mesh)
    return proj
  }

  /** 0 = ready to cast, 1 = just cast (full cooldown remaining). */
  getCooldownRatio(spellId: string): number {
    const spell     = SPELLS[spellId]
    if (!spell) return 0
    const remaining = this.cooldowns.get(spellId) ?? 0
    return remaining / spell.cooldown
  }

  isReady(spellId: string): boolean {
    return (this.cooldowns.get(spellId) ?? 0) <= 0
  }
}
