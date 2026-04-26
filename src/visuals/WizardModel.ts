import * as THREE from 'three'

export interface WizardModelConfig {
  /** Robe / body color */
  bodyColor: number
  /** Cuff / trim accent color (also used for staff orb glow ring) */
  accentColor: number
  /** Pointy hat color */
  hatColor: number
  /** Floating staff-tip orb color */
  orbColor: number
  /** Total visual height in world units (hat tip to robe base) */
  height: number
  /** Robe base radius */
  radius: number
  /** Optional emissive intensity for body (default 0.4) */
  emissiveIntensity?: number
}

export interface WizardModel {
  root: THREE.Group
  body: THREE.Mesh   // tapered robe — primary tint target
  head: THREE.Mesh   // small sphere
  hat:  THREE.Mesh   // cone
  staff: THREE.Mesh  // thin cylinder
  orb:  THREE.Mesh   // emissive sphere on staff
}

export function buildWizardModel(cfg: WizardModelConfig): WizardModel {
  const root = new THREE.Group()

  const robeHeight = cfg.height * 0.55
  const headRadius = cfg.radius * 0.55
  const hatHeight  = cfg.height * 0.35
  const hatRadius  = cfg.radius * 0.85

  // Robe: tapered cylinder, narrower at top
  const bodyGeo = new THREE.CylinderGeometry(cfg.radius * 0.65, cfg.radius, robeHeight, 12)
  const bodyMat = new THREE.MeshStandardMaterial({
    color:             new THREE.Color(cfg.bodyColor),
    emissive:          new THREE.Color(cfg.bodyColor),
    emissiveIntensity: cfg.emissiveIntensity ?? 0.4,
  })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.y = robeHeight / 2
  root.add(body)

  // Head: small sphere on top of robe
  const headGeo = new THREE.SphereGeometry(headRadius, 12, 8)
  const headMat = new THREE.MeshStandardMaterial({
    color:    new THREE.Color(cfg.accentColor),
    emissive: new THREE.Color(cfg.accentColor).multiplyScalar(0.2),
  })
  const head = new THREE.Mesh(headGeo, headMat)
  head.position.y = robeHeight + headRadius * 0.6
  root.add(head)

  // Hat: cone above head
  const hatGeo = new THREE.ConeGeometry(hatRadius, hatHeight, 12)
  const hatMat = new THREE.MeshStandardMaterial({
    color:             new THREE.Color(cfg.hatColor),
    emissive:          new THREE.Color(cfg.hatColor),
    emissiveIntensity: 0.3,
  })
  const hat = new THREE.Mesh(hatGeo, hatMat)
  hat.position.y = robeHeight + headRadius * 1.2 + hatHeight / 2
  root.add(hat)

  // Staff: thin cylinder offset to the side
  const staffHeight = cfg.height * 0.95
  const staffGeo = new THREE.CylinderGeometry(0.04, 0.04, staffHeight, 6)
  const staffMat = new THREE.MeshStandardMaterial({
    color:    0x553322,
    emissive: 0x110800,
  })
  const staff = new THREE.Mesh(staffGeo, staffMat)
  staff.position.set(cfg.radius * 0.95, staffHeight / 2 - 0.05, 0)
  root.add(staff)

  // Orb: emissive sphere at staff tip
  const orbGeo = new THREE.SphereGeometry(cfg.radius * 0.25, 10, 6)
  const orbMat = new THREE.MeshStandardMaterial({
    color:             new THREE.Color(cfg.orbColor),
    emissive:          new THREE.Color(cfg.orbColor),
    emissiveIntensity: 1.6,
  })
  const orb = new THREE.Mesh(orbGeo, orbMat)
  orb.position.set(cfg.radius * 0.95, staffHeight + cfg.radius * 0.1, 0)
  root.add(orb)

  return { root, body, head, hat, staff, orb }
}
