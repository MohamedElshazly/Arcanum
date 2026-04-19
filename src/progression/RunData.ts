export class RunData {
  spellsCastThisRun: Map<string, number> = new Map()
  collectedBooks:    string[][]          = []
  roomsCleared:     number              = 0
  enemiesDefeated:  number              = 0
  damageDealt:      number              = 0
  damageTaken:      number              = 0
  startTime:        number              = Date.now()

  /** Flat list of all collected spell IDs (compat with RunSummaryScreen stats). */
  get booksCollectedThisRun(): string[] {
    return this.collectedBooks.flat()
  }

  reset(): void {
    this.spellsCastThisRun = new Map()
    this.collectedBooks    = []
    this.roomsCleared      = 0
    this.enemiesDefeated   = 0
    this.damageDealt       = 0
    this.damageTaken       = 0
    this.startTime         = Date.now()
  }

  recordCast(spellId: string): void {
    this.spellsCastThisRun.set(spellId, (this.spellsCastThisRun.get(spellId) ?? 0) + 1)
  }

  recordBookCollected(spellIds: string[]): void {
    this.collectedBooks.push([...spellIds])
  }

  getCollectedSpellPool(): string[] {
    const seen = new Set<string>()
    for (const book of this.collectedBooks) {
      for (const id of book) seen.add(id)
    }
    return [...seen]
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
