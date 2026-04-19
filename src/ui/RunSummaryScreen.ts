import type { RunData }           from '../progression/RunData'
import { RUN_SUMMARY_AUTO_DISMISS_S } from '../constants'
import { SPELLS }                 from '../spells/SpellDefinitions'

export interface RunSummaryConfig {
  root:       HTMLDivElement
  runData:    RunData
  reason:     'death' | 'victory'
  onContinue: () => void
}

export class RunSummaryScreen {
  private root:       HTMLDivElement
  private config:     RunSummaryConfig
  private countdown:  number
  private timerId:    ReturnType<typeof setInterval> | null = null

  constructor(config: RunSummaryConfig) {
    this.root    = config.root
    this.config  = config
    this.countdown = RUN_SUMMARY_AUTO_DISMISS_S
  }

  show(): void {
    this.root.innerHTML = ''
    const panel = document.createElement('div')
    panel.className = 'run-summary-panel'

    const title = document.createElement('div')
    title.className   = 'run-summary-title ' + this.config.reason
    title.textContent = this.config.reason === 'victory' ? 'RUN COMPLETE' : 'DEFEATED'
    panel.appendChild(title)

    const grid = document.createElement('div')
    grid.className = 'run-summary-grid'

    const mostCast = this.config.runData.getMostCastSpell()
    const stats: { label: string; value: string }[] = [
      { label: 'ROOMS CLEARED',  value: String(this.config.runData.roomsCleared) },
      { label: 'ENEMIES SLAIN',  value: String(this.config.runData.enemiesDefeated) },
      { label: 'BOOKS COLLECTED', value: String(this.config.runData.booksCollectedThisRun.length) },
      { label: 'MOST CAST',       value: mostCast ? (SPELLS[mostCast.spellId]?.name ?? mostCast.spellId) + ` ×${mostCast.count}` : '—' },
      { label: 'DAMAGE DEALT',   value: String(Math.round(this.config.runData.damageDealt)) },
      { label: 'DAMAGE TAKEN',   value: String(Math.round(this.config.runData.damageTaken)) },
      { label: 'RUN DURATION',   value: this.formatDuration(this.config.runData.getDurationSeconds()) },
    ]

    for (const s of stats) {
      const stat = document.createElement('div')
      stat.className = 'run-summary-stat'
      const lbl = document.createElement('div')
      lbl.className   = 'run-stat-label'
      lbl.textContent = s.label
      const val = document.createElement('div')
      val.className   = 'run-stat-value'
      val.textContent = s.value
      stat.appendChild(lbl)
      stat.appendChild(val)
      grid.appendChild(stat)
    }
    panel.appendChild(grid)

    const btn = document.createElement('button')
    btn.className   = 'run-summary-continue-btn'
    btn.textContent = `Continue (${this.countdown}s)`
    btn.addEventListener('click', () => this.doContinue())
    panel.appendChild(btn)

    this.root.appendChild(panel)
    this.root.classList.add('visible')

    this.timerId = setInterval(() => {
      this.countdown--
      btn.textContent = `Continue (${this.countdown}s)`
      if (this.countdown <= 0) this.doContinue()
    }, 1000)
  }

  private doContinue(): void {
    if (this.timerId !== null) { clearInterval(this.timerId); this.timerId = null }
    this.dispose()
    this.config.onContinue()
  }

  private formatDuration(secs: number): string {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  dispose(): void {
    if (this.timerId !== null) { clearInterval(this.timerId); this.timerId = null }
    this.root.classList.remove('visible')
    this.root.innerHTML = ''
  }
}
