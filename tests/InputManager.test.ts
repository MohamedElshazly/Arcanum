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

  it('WASD maps to Arrow codes — W reports as ArrowUp', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))
    expect(input.isHeld('ArrowUp')).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }))
    expect(input.isHeld('ArrowUp')).toBe(false)
  })

  it('Digit1 maps to KeyQ — isJustPressed after update()', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', bubbles: true }))
    expect(input.isJustPressed('KeyQ')).toBe(false) // not yet promoted
    input.update()
    expect(input.isJustPressed('KeyQ')).toBe(true)
    input.update() // second frame
    expect(input.isJustPressed('KeyQ')).toBe(false) // cleared
  })

  it('does not double-register justPressed on key repeat events', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true })) // repeat
    input.update()
    expect(input.isHeld('ArrowLeft')).toBe(true)
    expect(input.isJustPressed('ArrowLeft')).toBe(true)
  })

  it('reports isJustReleased on the frame after keyup', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', bubbles: true }))
    input.update()
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit1', bubbles: true }))
    input.update()
    expect(input.isJustReleased('KeyQ')).toBe(true)
    input.update()
    expect(input.isJustReleased('KeyQ')).toBe(false)
  })

  it('raw arrow keys are ignored', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true }))
    input.update()
    expect(input.isHeld('ArrowUp')).toBe(false)
  })

  it('raw Q/E/R/F keys pass through directly', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }))
    input.update()
    expect(input.isJustPressed('KeyQ')).toBe(true)
  })

  it('Tab still registers normally', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', bubbles: true }))
    input.update()
    expect(input.isJustPressed('Tab')).toBe(true)
  })
})
