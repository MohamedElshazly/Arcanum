import type { RoomBounds } from '../dungeon/Room'

/**
 * Circle-vs-AABB in XZ plane.
 * Finds the nearest point on the rect to the circle center,
 * then checks if that distance is within the radius.
 */
export function circleVsRect(
  cx: number, cz: number, radius: number,
  minX: number, maxX: number, minZ: number, maxZ: number
): boolean {
  const nearestX = Math.max(minX, Math.min(cx, maxX))
  const nearestZ = Math.max(minZ, Math.min(cz, maxZ))
  const dx = cx - nearestX
  const dz = cz - nearestZ
  return dx * dx + dz * dz <= radius * radius
}

/** Returns true if (px, pz) lies outside the room bounds. */
export function isOutOfBounds(px: number, pz: number, bounds: RoomBounds): boolean {
  return px < bounds.minX || px > bounds.maxX || pz < bounds.minZ || pz > bounds.maxZ
}
