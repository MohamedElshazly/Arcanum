import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { InputManager } from '../src/core/InputManager'

describe('InputManager', () => {
  let input: InputManager

  beforeEach(() => {
    input = new InputManager()
  })

  afterEach(() => {
    input.dispose()
  })

  it('reports isHeld true while a key is held down', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true }))
    expect(input.isHeld('ArrowUp')).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp', bubbles: true }))
    expect(input.isHeld('ArrowUp')).toBe(false)
  })

  it('isJustPressed is false before update(), true after, false the next frame', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }))
    expect(input.isJustPressed('KeyQ')).toBe(false) // not yet promoted
    input.update()
    expect(input.isJustPressed('KeyQ')).toBe(true)
    input.update() // second frame
    expect(input.isJustPressed('KeyQ')).toBe(false) // cleared
  })

  it('does not double-register justPressed on key repeat events', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true })) // repeat
    input.update()
    expect(input.isHeld('ArrowLeft')).toBe(true)
    expect(input.isJustPressed('ArrowLeft')).toBe(true)
  })

  it('reports isJustReleased on the frame after keyup', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }))
    input.update()
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', bubbles: true }))
    input.update()
    expect(input.isJustReleased('KeyQ')).toBe(true)
    input.update()
    expect(input.isJustReleased('KeyQ')).toBe(false)
  })
})
