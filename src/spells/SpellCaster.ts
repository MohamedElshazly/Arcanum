import * as THREE from 'three'
import { Spell, SPELLS } from './SpellDefinitions'
import { Projectile }    from '../entities/Projectile'

export interface Entity {
  position: THREE.Vector3
  mesh:     THREE.Mesh
  alive:    boolean
}

export interface CastResult {
  success:     boolean
  failReason?: 'no_mana' | 'on_cooldown'
  projectile?: Projectile
  spellId?:    string
}

export class SpellCaster {
  /** spellId → timestamp of last cast (from THREE.Clock.getElapsedTime) */
  private cooldowns = new Map<string, number>()
  private manaSrc:   { mana: number }

  constructor(manaSrc: { mana: number }) {
    this.manaSrc = manaSrc
  }

  canCast(spell: Spell, currentMana: number, currentTime: number): boolean {
    if (currentMana < spell.manaCost) return false
    return this.getCooldownRemaining(spell.id, currentTime) <= 0
  }

  cast(
    spell:       Spell,
    caster:      Entity,
    targets:     Entity[],
    scene:       THREE.Scene,
    currentTime: number,
    direction?:  THREE.Vector3,
  ): CastResult {
    if (this.manaSrc.mana < spell.manaCost) {
      return { success: false, failReason: 'no_mana' }
    }
    if (this.getCooldownRemaining(spell.id, currentTime) > 0) {
      return { success: false, failReason: 'on_cooldown' }
    }

    this.manaSrc.mana -= spell.manaCost
    this.cooldowns.set(spell.id, currentTime)

    if (spell.type === 'projectile') {
      const dir = direction ?? this.directionToNearest(targets, caster.position)
      const origin = caster.position.clone().setY(0.75)
      const proj = new Projectile(origin, dir, spell, scene)
      return { success: true, projectile: proj }
    }

    // aoe / beam / self — Game.ts handles the actual effect via spellId
    return { success: true, spellId: spell.id }
  }

  getCooldownRemaining(spellId: string, currentTime: number): number {
    const spell    = SPELLS[spellId]
    if (!spell) return 0
    const lastCast = this.cooldowns.get(spellId)
    if (lastCast === undefined) return 0
    return Math.max(0, spell.cooldown - (currentTime - lastCast))
  }

  /** Returns 1 immediately after cast, decreasing to 0 as cooldown expires. */
  getCooldownPercent(spellId: string, currentTime: number): number {
    const spell = SPELLS[spellId]
    if (!spell || spell.cooldown <= 0) return 0
    return this.getCooldownRemaining(spellId, currentTime) / spell.cooldown
  }

  private directionToNearest(targets: Entity[], origin: THREE.Vector3): THREE.Vector3 {
    const alive = targets.filter(t => t.alive)
    if (alive.length === 0) return new THREE.Vector3(0, 0, 1)
    let nearest  = alive[0]
    let minDist  = origin.distanceTo(nearest.position)
    for (const t of alive.slice(1)) {
      const d = origin.distanceTo(t.position)
      if (d < minDist) { minDist = d; nearest = t }
    }
    return new THREE.Vector3()
      .subVectors(nearest.position, origin)
      .setY(0)
      .normalize()
  }
}
