import type { SpellElement } from '../spells/SpellDefinitions'
import type { DungeonData, EnemySpawnData, RoomData } from './DungeonGenerator'
import { getNeighborRoom } from './DungeonGenerator'
import type { BiomeType } from './BiomeDefinitions'

const ELEMENT_TO_BIOME: Record<SpellElement, BiomeType> = {
  fire: 'fire', ice: 'ice', lightning: 'lightning', arcane: 'arcane',
}

const ELEMENT_SPELLS: Record<SpellElement, string[]> = {
  fire:      ['fireball', 'flame_lance', 'ember_shot', 'pyroblast'],
  ice:       ['frost_bolt', 'frozen_nova', 'glacial_spike'],
  lightning: ['chain_lightning', 'spark', 'thunder_clap'],
  arcane:    ['arcane_missile', 'arcane_explosion', 'mana_siphon'],
}

const ELEMENTS: SpellElement[] = ['fire', 'ice', 'lightning', 'arcane']

function pickSpells(element: SpellElement, count: number, depth: number, rng: () => number): string[] {
  const pool = [...ELEMENT_SPELLS[element]]
  const spells: string[] = []
  if (depth >= 5) spells.push('blink')
  while (spells.length < count) {
    const idx  = Math.floor(rng() * pool.length)
    const pick = pool.splice(idx, 1)[0]
    if (!spells.includes(pick)) spells.push(pick)
    if (pool.length === 0) break
  }
  return spells.slice(0, count)
}

function enemyPositions(count: number, rng: () => number): Array<{ x: number; z: number }> {
  const positions: Array<{ x: number; z: number }> = []
  for (let i = 0; i < count; i++) {
    let x: number, z: number
    do {
      x = (rng() * 2 - 1) * 6
      z = (rng() * 2 - 1) * 6
    } while (Math.abs(x) < 2 && Math.abs(z) < 2)
    positions.push({ x, z })
  }
  return positions
}

function generateEnemies(room: RoomData, element: SpellElement, rng: () => number): EnemySpawnData[] {
  const d     = room.depth
  const elite = room.type === 'elite'

  let apprentices  = 0
  let battleMages  = 0

  if (d <= 2)      { apprentices = elite ? 3 : 2 }
  else if (d <= 4) { apprentices = elite ? 2 : 1; battleMages = elite ? 2 : 1 }
  else             { apprentices = elite ? 2 : 1; battleMages = elite ? 3 : 2 }

  const spellCount = d <= 2 ? 2 : d <= 4 ? 3 : 4
  const total      = apprentices + battleMages
  const positions  = enemyPositions(total, rng)
  const enemies: EnemySpawnData[] = []

  for (let i = 0; i < apprentices; i++) {
    enemies.push({
      archetype: 'apprentice',
      spellIds:  pickSpells(element, spellCount, d, rng),
      position:  positions[i],
      depth: d,
    })
  }
  for (let i = 0; i < battleMages; i++) {
    enemies.push({
      archetype: 'battle_mage',
      spellIds:  pickSpells(element, spellCount, d, rng),
      position:  positions[apprentices + i],
      depth: d,
    })
  }
  return enemies
}

export function assignBiomes(dungeon: DungeonData, rng: () => number): void {
  const queue: RoomData[] = [dungeon.startRoom]
  const seen = new Set<string>([dungeon.startRoom.id])
  dungeon.startRoom.depth = 0

  while (queue.length > 0) {
    const room = queue.shift()!
    for (const dir of room.connections) {
      const nb = getNeighborRoom(dungeon.grid, room, dir)
      if (nb && !seen.has(nb.id)) {
        seen.add(nb.id)
        nb.depth = room.depth + 1
        queue.push(nb)
      }
    }
  }

  const dominant: SpellElement = ELEMENTS[Math.floor(rng() * ELEMENTS.length)]
  const dominantBiome = ELEMENT_TO_BIOME[dominant]

  for (const room of dungeon.rooms) {
    if (room.type === 'boss') {
      room.biome = 'void'; room.hazardCount = 3; continue
    }
    if (room.type === 'rest') {
      room.biome = 'stone'; room.hazardCount = 0; continue
    }

    const d = room.depth
    if (d === 0) {
      room.biome = 'stone'; room.hazardCount = 0
    } else if (d <= 2) {
      room.biome       = rng() < 0.8 ? 'stone' : dominantBiome
      room.hazardCount = 0
    } else if (d <= 4) {
      room.biome       = dominantBiome
      room.hazardCount = room.type === 'elite' ? 3 : 1
    } else if (d <= 6) {
      room.biome       = dominantBiome
      room.hazardCount = room.type === 'elite' ? 3 : 2
    } else {
      room.biome       = dominantBiome
      room.hazardCount = 3
    }
    if (room.type === 'elite') room.hazardCount = 3
  }

  for (const room of dungeon.rooms) {
    if (room.type === 'start' || room.type === 'rest' || room.type === 'boss') {
      room.enemies = []; continue
    }
    const el: SpellElement = room.biome === 'stone' ? dominant : (room.biome as SpellElement)
    room.enemies = generateEnemies(room, el, rng)
  }
}
