import {
  MASTERY_L1_CASTS,
  MASTERY_L2_CASTS,
  MASTERY_L3_CASTS,
} from '../constants'
import { SPELLS } from '../spells/SpellDefinitions'

const STORAGE_KEY = 'mastery_cast_counts'

export class MasterySystem {
  private castCounts: Map<string, number> = new Map()

  load(): void {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, number>
      this.castCounts = new Map(Object.entries(obj))
    }
  }

  save(): void {
    const obj: Record<string, number> = {}
    for (const [k, v] of this.castCounts) obj[k] = v
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  }

  recordCast(spellId: string): void {
    const prev  = this.castCounts.get(spellId) ?? 0
    const next  = prev + 1
    this.castCounts.set(spellId, next)
    this.save()

    if (prev < MASTERY_L3_CASTS && next >= MASTERY_L3_CASTS) {
      const spell = SPELLS[spellId]
      if (spell?.masteryEvolvesTo) {
        dispatchEvent(
          new CustomEvent('spellEvolved', {
            detail: { originalId: spellId, evolvedId: spell.masteryEvolvesTo },
          }),
        )
      }
    }
  }

  getMasteryLevel(spellId: string): 0 | 1 | 2 | 3 {
    const c = this.castCounts.get(spellId) ?? 0
    if (c >= MASTERY_L3_CASTS) return 3
    if (c >= MASTERY_L2_CASTS) return 2
    if (c >= MASTERY_L1_CASTS) return 1
    return 0
  }

  getCastCount(spellId: string): number {
    return this.castCounts.get(spellId) ?? 0
  }

  getProgressToNextLevel(spellId: string): number {
    const c = this.getCastCount(spellId)
    if (c >= MASTERY_L3_CASTS) return 1
    if (c >= MASTERY_L2_CASTS) return (c - MASTERY_L2_CASTS) / (MASTERY_L3_CASTS - MASTERY_L2_CASTS)
    if (c >= MASTERY_L1_CASTS) return (c - MASTERY_L1_CASTS) / (MASTERY_L2_CASTS - MASTERY_L1_CASTS)
    return c / MASTERY_L1_CASTS
  }

  checkEvolution(spellId: string): string | null {
    if (this.getMasteryLevel(spellId) !== 3) return null
    return SPELLS[spellId]?.masteryEvolvesTo ?? null
  }
}
