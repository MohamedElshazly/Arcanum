export class RunData {
  spellsCastThisRun:     Map<string, number> = new Map()
  booksCollectedThisRun: string[]            = []
  roomsCleared:          number              = 0
  enemiesDefeated:       number              = 0
  damageDealt:           number              = 0
  damageTaken:           number              = 0
  startTime:             number              = Date.now()

  reset(): void {
    this.spellsCastThisRun     = new Map()
    this.booksCollectedThisRun = []
    this.roomsCleared          = 0
    this.enemiesDefeated       = 0
    this.damageDealt           = 0
    this.damageTaken           = 0
    this.startTime             = Date.now()
  }

  recordCast(spellId: string): void {
    this.spellsCastThisRun.set(spellId, (this.spellsCastThisRun.get(spellId) ?? 0) + 1)
  }

  recordBookCollected(spellId: string): void {
    this.booksCollectedThisRun.push(spellId)
  }

  getMostCastSpell(): { spellId: string; count: number } | null {
    let best: { spellId: string; count: number } | null = null
    for (const [spellId, count] of this.spellsCastThisRun) {
      if (!best || count > best.count) best = { spellId, count }
    }
    return best
  }

  getDurationSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000)
  }
}
