import * as THREE from 'three'
import { Spell, SPELLS } from './SpellDefinitions'
import { Projectile }    from '../entities/Projectile'
import type { MasterySystem } from '../progression/MasterySystem'
import type { Grimoire }      from '../progression/Grimoire'
import type { SfxManager }    from '../audio/SfxManager'

export interface Entity {
  position: THREE.Vector3
  mesh:     THREE.Object3D
  alive:    boolean
}

export interface CastResult {
  success:     boolean
  failReason?: 'no_mana' | 'on_cooldown'
  projectile?: Projectile
  spellId?:    string
}

export class SpellCaster {
  private cooldowns = new Map<string, number>()
  private manaSrc:   { mana: number }
  private mastery:   MasterySystem | null
  private grimoire:  Grimoire | null
  private sfx:       SfxManager | null = null

  constructor(
    manaSrc:  { mana: number },
    mastery:  MasterySystem | null = null,
    grimoire: Grimoire | null      = null,
  ) {
    this.manaSrc  = manaSrc
    this.mastery  = mastery
    this.grimoire = grimoire
  }

  setSfx(sfx: SfxManager): void { this.sfx = sfx }

  clearCooldowns(): void {
    this.cooldowns.clear()
  }

  canCast(spell: Spell, currentMana: number, currentTime: number): boolean {
    if (currentMana < this.effectiveCost(spell)) return false
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
    const cost = this.effectiveCost(spell)
    if (this.manaSrc.mana < cost) {
      return { success: false, failReason: 'no_mana' }
    }
    if (this.getCooldownRemaining(spell.id, currentTime) > 0) {
      return { success: false, failReason: 'on_cooldown' }
    }

    this.manaSrc.mana -= cost
    this.cooldowns.set(spell.id, currentTime)
    this.mastery?.recordCast(spell.id)

    if (this.sfx) {
      const phase = spell.type === 'self' ? 'utility' : 'cast'
      this.sfx.play(spell.element, phase)
      // AOE: layer impact 50ms after cast for body
      if (spell.type === 'aoe') {
        setTimeout(() => this.sfx?.play(spell.element, 'impact'), 50)
      }
    }

    if (spell.type === 'projectile') {
      const dir    = direction ?? this.directionToNearest(targets, caster.position)
      const origin = caster.position.clone().setY(0.75)
      const effectiveSpell = this.applyDamageBonus(spell)
      const proj   = new Projectile(origin, dir, effectiveSpell, scene, 0, this.sfx ?? undefined)

      if (spell.id === 'chain_lightning') {
        const extra = Math.round(this.grimoire?.getPassiveValue('lightning_chain_bounces') ?? 0)
        proj.jumpsRemaining = 3 + extra
      }

      return { success: true, projectile: proj }
    }

    return { success: true, spellId: spell.id }
  }

  getCooldownRemaining(spellId: string, currentTime: number): number {
    const spell    = SPELLS[spellId]
    if (!spell) return 0
    const lastCast = this.cooldowns.get(spellId)
    if (lastCast === undefined) return 0

    let cd = spell.cooldown
    const cdReduction = this.grimoire?.getPassiveValue('all_cooldown_reduction') ?? 0
    cd *= (1 - cdReduction)
    if (spellId === 'blink') {
      cd = Math.max(0.5, cd - (this.grimoire?.getPassiveValue('arcane_blink_cooldown') ?? 0))
    }
    return Math.max(0, cd - (currentTime - lastCast))
  }

  getCooldownPercent(spellId: string, currentTime: number): number {
    const spell = SPELLS[spellId]
    if (!spell || spell.cooldown <= 0) return 0
    const cdReduction = this.grimoire?.getPassiveValue('all_cooldown_reduction') ?? 0
    const effectiveCd = spell.cooldown * (1 - cdReduction)
    if (effectiveCd <= 0) return 0
    return this.getCooldownRemaining(spellId, currentTime) / effectiveCd
  }

  private effectiveCost(spell: Spell): number {
    const reduction = this.grimoire?.getPassiveValue('all_mana_cost_reduction') ?? 0
    return Math.max(0, Math.ceil(spell.manaCost * (1 - reduction)))
  }

  private applyDamageBonus(spell: Spell): Spell {
    const bonus = this.grimoire?.getPassiveValue('all_damage_bonus') ?? 0
    if (bonus === 0) return spell
    return { ...spell, damage: Math.round(spell.damage * (1 + bonus)) }
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
