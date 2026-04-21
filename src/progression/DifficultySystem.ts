export interface DifficultyMultipliers {
  enemyHp: number
  enemyDamage: number
  enemySpeed: number
  enemyCount: number
  bossHp: number
}

const DIFFICULTY_NAMES = [
  'Apprentice', 'Journeyman', 'Adept', 'Archmage', 'Mythic',
]

export class DifficultySystem {
  private _level = 0
  private _maxUnlocked = 0

  constructor() {
    this._maxUnlocked = parseInt(localStorage.getItem('max_difficulty') ?? '0', 10)
  }

  get level(): number { return this._level }
  set level(v: number) { this._level = Math.max(0, Math.min(v, this._maxUnlocked)) }

  get maxUnlocked(): number { return this._maxUnlocked }

  get name(): string {
    if (this._level < DIFFICULTY_NAMES.length) return DIFFICULTY_NAMES[this._level]
    return `Mythic +${this._level - 4}`
  }

  getMultipliers(): DifficultyMultipliers {
    const l = this._level
    return {
      enemyHp:     1 + l * 0.25,
      enemyDamage: 1 + l * 0.15,
      enemySpeed:  1 + l * 0.08,
      enemyCount:  1 + l * 0.1,
      bossHp:      1 + l * 0.3,
    }
  }

  unlockNext(): void {
    const next = this._level + 1
    if (next > this._maxUnlocked) {
      this._maxUnlocked = next
      localStorage.setItem('max_difficulty', String(next))
    }
  }
}
