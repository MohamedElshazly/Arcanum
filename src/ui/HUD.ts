import type { Player }       from '../entities/Player'
import type { SpellCaster }  from '../spells/SpellCaster'
import type { SpellBar }     from '../spells/SpellBar'
import type { DungeonData }  from '../dungeon/DungeonGenerator'

export class HUD {
  private hpFill!:       HTMLElement
  private manaFill!:     HTMLElement
  private barIndicator!: HTMLElement
  private bar1El!:       HTMLElement
  private bar2El!:       HTMLElement

  private minimapCanvas!: HTMLCanvasElement
  private minimapCtx!:    CanvasRenderingContext2D

  // [barIndex 0|1][slotIndex 0-3]
  private slots:     HTMLElement[][] = [[], []]
  private cooldowns: HTMLElement[][] = [[], []]
  private names:     HTMLElement[][] = [[], []]
  private costs:     HTMLElement[][] = [[], []]

  init(): void {
    this.hpFill       = document.getElementById('hp-fill')!
    this.manaFill     = document.getElementById('mana-fill')!
    this.barIndicator = document.getElementById('bar-indicator')!
    this.bar1El       = document.getElementById('bar-1')!
    this.bar2El       = document.getElementById('bar-2')!
    this.minimapCanvas = document.getElementById('minimap') as HTMLCanvasElement
    this.minimapCtx    = this.minimapCanvas.getContext('2d')!

    for (let i = 0; i < 4; i++) {
      this.slots[0].push(document.getElementById(`bar1-slot-${i}`)!)
      this.slots[1].push(document.getElementById(`bar2-slot-${i}`)!)
      this.cooldowns[0].push(document.getElementById(`bar1-cd-${i}`)!)
      this.cooldowns[1].push(document.getElementById(`bar2-cd-${i}`)!)
      this.names[0].push(document.getElementById(`bar1-name-${i}`)!)
      this.names[1].push(document.getElementById(`bar2-name-${i}`)!)
      this.costs[0].push(document.getElementById(`bar1-cost-${i}`)!)
      this.costs[1].push(document.getElementById(`bar2-cost-${i}`)!)
    }
  }

  update(
    player: Player,
    caster: SpellCaster,
    spellBar: SpellBar,
    currentTime: number,
    dungeonData?: DungeonData,
    currentRoomId?: string,
  ): void {
    this.hpFill.style.width   = `${(player.hp   / player.maxHp)   * 100}%`
    this.manaFill.style.width = `${(player.mana  / player.maxMana) * 100}%`

    this.bar1El.className = 'spell-bar ' + (spellBar.activeBar === 1 ? 'active' : 'inactive')
    this.bar2El.className = 'spell-bar ' + (spellBar.activeBar === 2 ? 'active' : 'inactive')

    this.barIndicator.innerHTML = `BAR ${spellBar.activeBar}<br><span class="tab-hint">TAB</span>`

    const barArrays = [spellBar.bar1, spellBar.bar2]
    for (let b = 0; b < 2; b++) {
      for (let s = 0; s < 4; s++) {
        const spell = barArrays[b][s]
        const slot  = this.slots[b][s]
        const cd    = this.cooldowns[b][s]
        const name  = this.names[b][s]
        const cost  = this.costs[b][s]

        if (!spell) {
          slot.removeAttribute('data-element')
          name.textContent = ''
          cost.textContent = ''
          cd.style.height  = '0%'
          cd.textContent   = ''
          continue
        }

        slot.dataset.element = spell.element
        name.textContent     = spell.name.substring(0, 9)
        cost.textContent     = `${spell.manaCost}MP`

        const pct       = caster.getCooldownPercent(spell.id, currentTime)
        const remaining = caster.getCooldownRemaining(spell.id, currentTime)
        cd.style.height = `${pct * 100}%`
        cd.textContent  = remaining > 0.05 ? remaining.toFixed(1) : ''
      }
    }

    if (dungeonData) this.drawMinimap(dungeonData, currentRoomId ?? '')
  }

  /** Flash the slot briefly on successful cast. */
  onCastSuccess(barIndex: 0 | 1, slotIndex: number): void {
    const slot = this.slots[barIndex][slotIndex]
    slot.classList.remove('slot-flash')
    void (slot as HTMLElement).offsetWidth
    slot.classList.add('slot-flash')
    setTimeout(() => slot.classList.remove('slot-flash'), 150)
  }

  /** Shake the slot to signal mana failure or cooldown. */
  onCastFail(barIndex: 0 | 1, slotIndex: number): void {
    const slot = this.slots[barIndex][slotIndex]
    slot.classList.remove('slot-shake')
    void (slot as HTMLElement).offsetWidth
    slot.classList.add('slot-shake')
    setTimeout(() => slot.classList.remove('slot-shake'), 200)
  }

  /** Pulse the bar indicator when the active bar changes. */
  onBarToggle(): void {
    this.barIndicator.classList.remove('pulse')
    void (this.barIndicator as HTMLElement).offsetWidth
    this.barIndicator.classList.add('pulse')
    setTimeout(() => this.barIndicator.classList.remove('pulse'), 500)
  }

  private drawMinimap(
    dungeon: DungeonData,
    currentRoomId: string,
  ): void {
    const ctx   = this.minimapCtx
    const CELL  = 8
    const PAD   = 2
    const GRID  = CELL + PAD

    ctx.clearRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height)

    ctx.strokeStyle = '#555'
    ctx.lineWidth   = 1
    for (const room of dungeon.rooms) {
      if (!room.visited) continue
      const rx = PAD + room.gridX * GRID + CELL / 2
      const ry = PAD + room.gridY * GRID + CELL / 2
      for (const dir of room.connections) {
        const nb = dungeon.grid[
          room.gridY + (dir === 'south' ? 1 : dir === 'north' ? -1 : 0)
        ]?.[
          room.gridX + (dir === 'east' ? 1 : dir === 'west' ? -1 : 0)
        ]
        if (nb?.visited) {
          const nx = PAD + nb.gridX * GRID + CELL / 2
          const ny = PAD + nb.gridY * GRID + CELL / 2
          ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(nx, ny); ctx.stroke()
        }
      }
    }

    const TYPE_COLOR: Record<string, string> = {
      start:  '#ffffff',
      normal: '#888888',
      elite:  '#660000',
      rest:   '#006600',
      boss:   '#220022',
    }

    const BIOME_TINT: Record<string, string> = {
      fire: 'rgba(255,68,0,0.3)',  ice: 'rgba(100,200,255,0.3)',
      lightning: 'rgba(255,255,0,0.2)', arcane: 'rgba(136,0,255,0.3)',
      void: 'rgba(100,0,50,0.4)',  stone: 'rgba(80,80,80,0.2)',
    }

    for (const room of dungeon.rooms) {
      const rx = PAD + room.gridX * GRID
      const ry = PAD + room.gridY * GRID

      if (!room.visited) {
        ctx.fillStyle = '#111'
        ctx.fillRect(rx, ry, CELL, CELL)
        ctx.strokeStyle = '#333'
        ctx.lineWidth   = 0.5
        ctx.strokeRect(rx, ry, CELL, CELL)
      } else {
        ctx.fillStyle = TYPE_COLOR[room.type] ?? '#888'
        ctx.fillRect(rx, ry, CELL, CELL)
        ctx.fillStyle = BIOME_TINT[room.biome] ?? ''
        ctx.fillRect(rx, ry, CELL, CELL)
      }

      if (room.id === currentRoomId) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth   = 1
        ctx.strokeRect(rx, ry, CELL, CELL)
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(rx + CELL / 2, ry + CELL / 2, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}
