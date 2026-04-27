import * as THREE from 'three'

interface PortalInitOptions {
  scene:        THREE.Scene
  spawnPoint:   { x: number; y: number; z: number }
  exitPosition: { x: number; y: number; z: number }
  exitLabel?:   string
  /** Visual scale applied to portal groups after init. Defaults to 0.15 to fit Arcanum's room size. */
  scale?:       number
  /** XZ-plane radius the player must enter to trigger a redirect. Defaults to 1.5 world units. */
  triggerRadius?: number
}

interface VibeJamWindow extends Window {
  THREE?:               typeof THREE
  initVibeJamPortals?:  (opts: {
    scene:        THREE.Scene
    spawnPoint:   { x: number; y: number; z: number }
    exitPosition: { x: number; y: number; z: number }
    exitLabel?:   string
    getPlayer?:   () => THREE.Object3D | null | undefined
  }) => void
  /** We do NOT call this — the sample's collision logic uses a stale Box3 from before
   *  we scaled the portal groups, which triggers from far too great a distance. */
  animateVibeJamPortals?: () => void
}

const w = window as VibeJamWindow

let exitGroup:  THREE.Group | null = null
let startGroup: THREE.Group | null = null
let exitPos     = new THREE.Vector3()
let startPos    = new THREE.Vector3()
let triggerR2   = 1.5 * 1.5
let arrived     = false
let activateAt  = 0
let redirected  = false

/** Was the player redirected here by another Vibe Jam game? */
export function arrivedViaPortal(): boolean {
  const qs = new URLSearchParams(window.location.search)
  return qs.get('portal') === 'true' || qs.get('portal') === '1'
}

/** Initialize portals in the given scene. Idempotent within a page load. */
export function initPortals(opts: PortalInitOptions): void {
  if (exitGroup) return  // already initialized

  if (!w.initVibeJamPortals) {
    console.warn('[VibeJam] portal sample script not loaded — skipping portal init')
    return
  }
  // Sample script references the THREE global inside its function bodies.
  if (!w.THREE) w.THREE = THREE

  arrived = arrivedViaPortal()
  exitPos.set(opts.exitPosition.x, opts.exitPosition.y, opts.exitPosition.z)
  startPos.set(opts.spawnPoint.x,  opts.spawnPoint.y,  opts.spawnPoint.z)
  triggerR2 = (opts.triggerRadius ?? 1.5) ** 2

  const beforeCount = opts.scene.children.length
  w.initVibeJamPortals({
    scene:        opts.scene,
    spawnPoint:   opts.spawnPoint,
    exitPosition: opts.exitPosition,
    exitLabel:    opts.exitLabel ?? 'VIBE JAM PORTAL',
    // No-op getPlayer — the sample's built-in collision uses a stale Box3,
    // so we skip its animateVibeJamPortals() entirely and run our own.
    getPlayer:    () => null,
  })

  const scale = opts.scale ?? 0.15
  const newGroups: THREE.Group[] = []
  for (let i = beforeCount; i < opts.scene.children.length; i++) {
    const child = opts.scene.children[i]
    if (child instanceof THREE.Group) {
      child.scale.setScalar(scale)
      newGroups.push(child)
    }
  }

  // The sample adds the start portal first (only when arriving via portal),
  // then the exit portal. Order matters for our reference capture.
  if (arrived) {
    startGroup = newGroups[0] ?? null
    exitGroup  = newGroups[1] ?? null
    activateAt = Date.now() + 5000  // 5s grace before the start portal can re-redirect
  } else {
    exitGroup  = newGroups[0] ?? null
  }
}

/**
 * Tick portal particle animation + run our own tight, XZ-plane collision check.
 * Pass `inStartRoom = false` to hide the portals and skip the trigger when the
 * player is anywhere other than the start room.
 */
export function updatePortals(playerPos: THREE.Vector3, inStartRoom: boolean): void {
  if (redirected) return
  if (exitGroup)  exitGroup.visible  = inStartRoom
  if (startGroup) startGroup.visible = inStartRoom

  if (!inStartRoom) return

  animateParticles(exitGroup)
  animateParticles(startGroup)

  // XZ proximity check — the player walks across a horizontal plane, so we
  // ignore the y axis. distanceSquared is cheaper than distance.
  const dxe = playerPos.x - exitPos.x
  const dze = playerPos.z - exitPos.z
  if (dxe * dxe + dze * dze < triggerR2) {
    redirectToExit()
    return
  }

  if (arrived && startGroup && Date.now() >= activateAt) {
    const dxs = playerPos.x - startPos.x
    const dzs = playerPos.z - startPos.z
    if (dxs * dxs + dzs * dzs < triggerR2) {
      redirectBack()
    }
  }
}

function animateParticles(group: THREE.Group | null): void {
  if (!group) return
  for (const child of group.children) {
    if (!(child instanceof THREE.Points)) continue
    const attr = child.geometry.attributes.position as THREE.BufferAttribute
    const arr  = attr.array as Float32Array
    const t    = Date.now() * 0.001
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] += 0.05 * Math.sin(t + i)
    }
    attr.needsUpdate = true
  }
}

function redirectToExit(): void {
  redirected = true
  const params = new URLSearchParams(window.location.search)
  params.set('portal', 'true')
  params.set('ref', window.location.hostname)
  window.location.href = 'https://vibej.am/portal/2026?' + params.toString()
}

function redirectBack(): void {
  const params = new URLSearchParams(window.location.search)
  const ref = params.get('ref')
  if (!ref) return
  let url = ref
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  params.delete('ref')
  redirected = true
  const s = params.toString()
  window.location.href = url + (s ? '?' + s : '')
}
