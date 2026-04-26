import * as THREE from 'three'

interface PortalInitOptions {
  scene:        THREE.Scene
  getPlayer:    () => THREE.Object3D | null | undefined
  spawnPoint:   { x: number; y: number; z: number }
  exitPosition: { x: number; y: number; z: number }
  exitLabel?:   string
  /** Visual scale applied to portal groups after init. Defaults to 0.15 to fit Arcanum's room size. */
  scale?:       number
}

interface VibeJamWindow extends Window {
  THREE?:                  typeof THREE
  initVibeJamPortals?:     (opts: Omit<PortalInitOptions, 'scale'>) => void
  animateVibeJamPortals?:  () => void
}

const w = window as VibeJamWindow

/** Was the player redirected here by another Vibe Jam game? */
export function arrivedViaPortal(): boolean {
  const qs = new URLSearchParams(window.location.search)
  return qs.get('portal') === 'true' || qs.get('portal') === '1'
}

/** Initialize portals in the given scene. Idempotent within a page load. */
export function initPortals(opts: PortalInitOptions): void {
  if (!w.initVibeJamPortals) {
    console.warn('[VibeJam] portal sample script not loaded — skipping portal init')
    return
  }
  // The sample script references the THREE global inside its function bodies.
  // We bundle THREE via Vite, so we expose it on window before the first call.
  if (!w.THREE) w.THREE = THREE

  const before = opts.scene.children.length

  w.initVibeJamPortals({
    scene:        opts.scene,
    getPlayer:    opts.getPlayer,
    spawnPoint:   opts.spawnPoint,
    exitPosition: opts.exitPosition,
    exitLabel:    opts.exitLabel ?? 'VIBE JAM PORTAL',
  } as Parameters<NonNullable<VibeJamWindow['initVibeJamPortals']>>[0])

  // The sample uses TorusGeometry(15, 2, ...) — about 30 units across.
  // Arcanum's player is 0.4 units in radius. Scale the new groups down so
  // the portals fit. Note: collision Box3 is captured internally at original
  // size, which gives a generous trigger zone — that's fine for portal UX.
  const scale = opts.scale ?? 0.15
  for (let i = before; i < opts.scene.children.length; i++) {
    opts.scene.children[i].scale.setScalar(scale)
  }
}

/** Tick portal particle animation + collision checks. Call once per frame. */
export function animatePortals(): void {
  if (w.animateVibeJamPortals) w.animateVibeJamPortals()
}
