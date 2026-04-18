import { describe, it, expect } from 'vitest'
import { scaleEnemyStats } from '../src/entities/Enemy'

describe('scaleEnemyStats', () => {
  it('apprentice base HP at depth 0 is 40',    () => expect(scaleEnemyStats('apprentice', 0).hp).toBe(40))
  it('battle_mage base HP at depth 0 is 80',   () => expect(scaleEnemyStats('battle_mage', 0).hp).toBe(80))
  it('HP scales ~1.15 per depth',              () => expect(scaleEnemyStats('apprentice', 1).hp).toBeCloseTo(46, 0))
  it('HP cap at depth 8',                      () => expect(scaleEnemyStats('apprentice', 8).hp).toBe(scaleEnemyStats('apprentice', 9).hp))
  it('apprentice base speed is 2.5',           () => expect(scaleEnemyStats('apprentice', 0).speed).toBeCloseTo(2.5, 2))
  it('speed scales ~1.05 per depth',           () => expect(scaleEnemyStats('apprentice', 1).speed).toBeCloseTo(2.625, 2))
  it('speed cap at depth 6',                   () => expect(scaleEnemyStats('apprentice', 6).speed).toBeCloseTo(scaleEnemyStats('apprentice', 7).speed, 4))
  it('castInterval at depth 0 is 2.0',         () => expect(scaleEnemyStats('apprentice', 0).castInterval).toBeCloseTo(2.0, 2))
  it('castInterval min is 0.8',                () => expect(scaleEnemyStats('apprentice', 20).castInterval).toBeCloseTo(0.8, 2))
  it('spellCount 2 at depth 0',                () => expect(scaleEnemyStats('apprentice', 0).spellCount).toBe(2))
  it('spellCount 3 at depth 3',                () => expect(scaleEnemyStats('apprentice', 3).spellCount).toBe(3))
  it('spellCount 4 at depth 5',                () => expect(scaleEnemyStats('apprentice', 5).spellCount).toBe(4))
})
