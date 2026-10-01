import * as THREE from 'three'
import { frustumHeight, pointConeHeight } from '../lib/drillMath'
import type { DrillParams, WebThinningStyle } from '../lib/types'

export interface DrillMaterials {
  shank: THREE.Material
  cutting: THREE.Material
  flute: THREE.Material
  tip: THREE.Material
  hole: THREE.Material
  margin: THREE.Material
}

interface FluteOptions {
  groove?: number
  radial?: number
  angleOffset?: number
  /** Second land, drawn by the twist body. Not a flute groove. */
  doubleMargin?: boolean
}

function finite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback
}

function addCyl(
  group: THREE.Group,
  radius: number,
  length: number,
  zStart: number,
  material: THREE.Material,
  segments = 28,
): number {
  const h = Math.max(length, 0.02)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(radius, 0.01), Math.max(radius, 0.01), h, segments), material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.z = zStart + h / 2
  group.add(mesh)
  return zStart + h
}

function addCone(
  group: THREE.Group,
  radius: number,
  length: number,
  zStart: number,
  material: THREE.Material,
): number {
  const h = Math.max(length, 0.02)
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(Math.max(radius, 0.01), h, 28), material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.z = zStart + h / 2
  group.add(mesh)
  return zStart + h
}

function addFrustum(
  group: THREE.Group,
  radiusTip: number,
  radiusBack: number,
  length: number,
  zStart: number,
  material: THREE.Material,
): number {
  const h = Math.max(length, 0.02)
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(Math.max(radiusTip, 0.01), Math.max(radiusBack, 0.01), h, 28),
    material,
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.z = zStart + h / 2
  group.add(mesh)
  return zStart + h
}

function addFlutes(
  group: THREE.Group,
  radius: number,
  length: number,
  z0: number,
  fluteCount: number,
  helixDeg: number,
  material: THREE.Material,
  options?: FluteOptions,
): void {
  const count = Math.max(1, Math.round(finite(fluteCount, 2)))
  const groove = options?.groove ?? 1
  const radial = options?.radial ?? 0.8
  const segs = Math.max(5, Math.min(22, Math.round(length / Math.max(radius * 0.85, 0.08))))
  const helix = (finite(helixDeg, 0) * Math.PI) / 180
  const lead = Math.tan(helix)
  for (let i = 0; i < count; i++) {
    const base = (i / count) * Math.PI * 2 + (options?.angleOffset ?? 0)
    for (let s = 0; s < segs; s++) {
      const t = (s + 0.5) / segs
      const z = z0 + length * t
      const twist = (lead * length * t) / Math.max(radius, 0.05)
      const angle = base + twist
      const gr = Math.max(radius * 0.26 * groove, 0.012)
      const ball = new THREE.Mesh(new THREE.SphereGeometry(gr, 7, 5), material)
      ball.position.set(Math.cos(angle) * radius * radial, Math.sin(angle) * radius * radial, z)
      group.add(ball)
    }
  }
}

function addConeFlutes(
  group: THREE.Group,
  radius: number,
  length: number,
  z0: number,
  fluteCount: number,
  material: THREE.Material,
): void {
  const count = Math.max(1, Math.round(finite(fluteCount, 2)))
  const segs = 7
  for (let i = 0; i < count; i++) {
    const base = (i / count) * Math.PI * 2
    for (let s = 0; s < segs; s++) {
      const t = (s + 0.5) / segs
      const r = Math.max(radius * t, 0.01)
      const ball = new THREE.Mesh(new THREE.SphereGeometry(Math.max(r * 0.28, 0.012), 6, 4), material)
      ball.position.set(Math.cos(base) * r * 0.72, Math.sin(base) * r * 0.72, z0 + length * t)
      group.add(ball)
    }
  }
}

function addWebSlot(
  group: THREE.Group,
  radius: number,
  coneH: number,
  style: WebThinningStyle,
  material: THREE.Material,
): void {
  if (style === 'none' || coneH < 0.04) return
  const make = (turn: number) => {
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 1.7, Math.max(radius * 0.16, 0.02), coneH * 0.55),
      material,
    )
    slot.position.z = coneH * 0.28
    slot.rotation.z = turn
    group.add(slot)
  }
  if (style === 'X') {
    make(Math.PI / 5)
    make(-Math.PI / 5)
    return
  }
  make(0)
}

function addCoolant(
  group: THREE.Group,
  radius: number,
  length: number,
  z0: number,
  holes: number,
  holeRadius: number,
  material: THREE.Material,
  coneHeight = 0,
): void {
  const count = Math.max(0, Math.round(holes))
  if (count <= 0 || length <= 0) return
  const hr = Math.max(holeRadius, radius * 0.08)
  if (count === 1) {
    addCyl(group, hr, length, z0, material, 12)
    return
  }
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    const offset = radius * 0.32
    const h = Math.max(length, 0.02)
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(hr, hr, h, 10), material)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(Math.cos(angle) * offset, Math.sin(angle) * offset, z0 + h / 2)
    group.add(mesh)
  }
  if (coneHeight <= 0.02) return
  const exitT = 0.62
  const exitZ = coneHeight * exitT
  const exitRadius = Math.max(radius * exitT, hr * 1.4)
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.PI / count
    const port = new THREE.Mesh(new THREE.SphereGeometry(Math.max(hr, radius * 0.14), 8, 6), material)
    port.position.set(Math.cos(angle) * exitRadius, Math.sin(angle) * exitRadius, exitZ)
    group.add(port)
  }
}

function addShank(group: THREE.Group, drill: DrillParams, scale: number, z: number, mats: DrillMaterials): number {
  const radius = (Math.max(finite(drill.shankDiameter, drill.diameter), 0.2) * scale) / 2
  const length = Math.max(finite(drill.shankLength, 10), 0.5) * scale
  return addCyl(group, radius, length, z, mats.shank, 32)
}

function twistBody(
  group: THREE.Group,
  drill: DrillParams,
  scale: number,
  mats: DrillMaterials,
  options?: FluteOptions,
): void {
  const radius = (Math.max(drill.diameter, 0.05) * scale) / 2
  const flute = Math.max(drill.fluteLength, 0.3) * scale
  const cone = Math.min(pointConeHeight(drill.diameter, drill.pointAngle) * scale, flute * 0.8)
  let z = 0
  if (cone > 0.02) {
    z = addCone(group, radius, cone, z, mats.tip)
    addConeFlutes(group, radius, cone, 0, drill.fluteCount, mats.flute)
    addWebSlot(group, radius, cone, drill.webThinning, mats.flute)
  } else {
    z = addCyl(group, radius, Math.max(0.08, 0.35 * scale), z, mats.tip, 24)
  }
  const body = Math.max(flute - cone, 0.08)
  const bodyStart = z
  z = addCyl(group, radius, body, z, mats.cutting)
  addFlutes(group, radius, body, bodyStart, drill.fluteCount, drill.helixAngle, mats.flute, options)
  if (options?.doubleMargin) {
    addFlutes(group, radius, body, bodyStart, drill.fluteCount, drill.helixAngle, mats.margin, {
      groove: 0.42,
      radial: 0.97,
      angleOffset: 0.38,
    })
  }
  if (drill.coolantHoles > 0) {
    addCoolant(
      group,
      radius,
      flute * 0.92,
      cone * 0.35,
      drill.coolantHoles,
      (Math.max(drill.coolantHoleDiameter, 0.05) * scale) / 2,
      mats.hole,
      cone,
    )
  }
  addShank(group, drill, scale, z, mats)
}

function addSpot(group: THREE.Group, drill: DrillParams, scale: number, mats: DrillMaterials): void {
  const radius = (Math.max(drill.diameter, 0.2) * scale) / 2
  const cone = Math.max(pointConeHeight(drill.diameter, drill.pointAngle) * scale, radius * 0.8)
  let z = addCone(group, radius, cone, 0, mats.tip)
  addConeFlutes(group, radius, cone, 0, drill.fluteCount, mats.flute)
  const land = Math.max(drill.fluteLength * scale - cone, radius * 0.45)
  const landStart = z
  z = addCyl(group, radius, land, z, mats.cutting)
  addFlutes(group, radius, land, landStart, drill.fluteCount, drill.helixAngle, mats.flute, { groove: 0.8 })
  addShank(group, drill, scale, z, mats)
}

function addCenter(group: THREE.Group, drill: DrillParams, scale: number, mats: DrillMaterials): void {
  const pilotR = (Math.max(drill.diameter, 0.1) * scale) / 2
  const bodyR = (Math.max(drill.countersinkDiameter, drill.diameter) * scale) / 2
  const pilotCone = Math.min(
    pointConeHeight(drill.diameter, drill.pointAngle) * scale,
    Math.max(drill.pilotLength, 0.2) * scale * 0.7,
  )
  let z = 0
  if (pilotCone > 0.015) z = addCone(group, pilotR, pilotCone, z, mats.tip)
  const pilotCyl = Math.max(drill.pilotLength * scale - pilotCone, 0.03)
  const pilotStart = z
  z = addCyl(group, pilotR, pilotCyl, z, mats.cutting, 20)
  addFlutes(group, pilotR, pilotCyl, pilotStart, 2, 12, mats.flute, { groove: 0.7 })
  const csk = Math.max(frustumHeight(drill.diameter, drill.countersinkDiameter, drill.countersinkAngle) * scale, 0.04)
  z = addFrustum(group, pilotR, bodyR, csk, z, mats.tip)
  addShank(group, drill, scale, z, mats)
}

function addStep(group: THREE.Group, drill: DrillParams, scale: number, mats: DrillMaterials): void {
  const steps = drill.steps.length > 0 ? drill.steps : [{ diameter: drill.diameter, length: drill.fluteLength }]
  let z = 0
  steps.forEach((step, index) => {
    const radius = (Math.max(step.diameter, 0.1) * scale) / 2
    const length = Math.max(step.length, 0.2) * scale
    if (index === 0) {
      const cone = Math.min(pointConeHeight(step.diameter, drill.pointAngle) * scale, length * 0.75)
      if (cone > 0.02) {
        z = addCone(group, radius, cone, z, mats.tip)
        addWebSlot(group, radius, cone, drill.webThinning, mats.flute)
      }
      const body = Math.max(length - cone, 0.05)
      const start = z
      z = addCyl(group, radius, body, z, mats.cutting)
      addFlutes(group, radius, body, start, drill.fluteCount, drill.helixAngle, mats.flute)
      return
    }
    z = addCyl(group, radius, Math.max(0.07, 0.28 * scale), z, mats.tip, 24)
    const start = z
    z = addCyl(group, radius, length, z, mats.cutting)
    addFlutes(group, radius, length, start, drill.fluteCount, drill.helixAngle, mats.flute)
  })
  addShank(group, drill, scale, z, mats)
}

function addSubland(group: THREE.Group, drill: DrillParams, scale: number, mats: DrillMaterials): void {
  const frontR = (Math.max(drill.diameter, 0.1) * scale) / 2
  const rearR = (Math.max(drill.sublandDiameter, drill.diameter) * scale) / 2
  const frontLen = Math.max(drill.fluteLength, 0.3) * scale
  const cone = Math.min(pointConeHeight(drill.diameter, drill.pointAngle) * scale, frontLen * 0.7)
  let z = 0
  if (cone > 0.02) z = addCone(group, frontR, cone, z, mats.tip)
  const frontBody = Math.max(frontLen - cone, 0.05)
  const frontStart = z
  z = addCyl(group, frontR, frontBody, z, mats.cutting)
  addFlutes(group, frontR, frontBody, frontStart, drill.fluteCount, drill.helixAngle, mats.flute)
  const shoulder = Math.max(frustumHeight(drill.diameter, drill.sublandDiameter, drill.pointAngle) * scale, 0.05)
  z = addFrustum(group, frontR, rearR, shoulder, z, mats.tip)
  const rearLen = Math.max(drill.sublandLength, 0.3) * scale
  const rearStart = z
  z = addCyl(group, rearR, rearLen, z, mats.cutting)
  addFlutes(group, rearR, rearLen, rearStart, drill.fluteCount, drill.helixAngle, mats.flute)
  addShank(group, drill, scale, z, mats)
}

function addGun(group: THREE.Group, drill: DrillParams, scale: number, mats: DrillMaterials): void {
  const radius = (Math.max(drill.diameter, 0.2) * scale) / 2
  const flute = Math.max(drill.fluteLength, 1) * scale
  const cone = Math.max(pointConeHeight(drill.diameter, drill.pointAngle) * scale, radius * 0.9)
  const tip = new THREE.Mesh(new THREE.ConeGeometry(radius, cone, 14), mats.tip)
  tip.rotation.x = -Math.PI / 2
  tip.position.set(radius * 0.22, 0, cone / 2)
  group.add(tip)
  let z = cone * 0.55
  const headLen = Math.min(Math.max(16 * scale, radius * 3.5), flute * 0.22)
  const headStart = z
  z = addCyl(group, radius, headLen, z, mats.cutting)
  const tubeLen = Math.max(flute - headLen - cone * 0.55, radius)
  z = addCyl(group, radius * 0.96, tubeLen, z, mats.shank)
  const grooves = drill.gunFluteStyle === 'v' || drill.fluteCount >= 2 ? 2 : 1
  addFlutes(group, radius, headLen + tubeLen * 0.98, headStart, grooves, 0, mats.flute, { groove: 1.35, radial: 0.72 })
  if (drill.coolantHoles > 0) {
    addCoolant(
      group,
      radius,
      flute * 0.96,
      0.02,
      1,
      (Math.max(drill.coolantHoleDiameter, drill.diameter * 0.12) * scale) / 2,
      mats.hole,
    )
  }
  const shankR = (Math.max(drill.shankDiameter, drill.diameter) * scale) / 2
  const shankLen = Math.max(drill.shankLength, 8) * scale
  const shankStart = z
  z = addCyl(group, Math.max(shankR, radius), shankLen, z, mats.shank)
  const flat = new THREE.Mesh(
    new THREE.BoxGeometry(shankR * 0.45, shankR * 1.3, Math.min(shankLen * 0.28, 8 * scale)),
    mats.flute,
  )
  flat.position.set(shankR * 0.8, 0, shankStart + shankLen * 0.45)
  group.add(flat)
}

function addCountersink(group: THREE.Group, drill: DrillParams, scale: number, mats: DrillMaterials): void {
  const radius = (Math.max(drill.diameter, 0.1) * scale) / 2
  const chamferR = (Math.max(drill.chamferDiameter, drill.diameter) * scale) / 2
  const flute = Math.max(drill.fluteLength, 0.3) * scale
  const cone = Math.min(pointConeHeight(drill.diameter, drill.pointAngle) * scale, flute * 0.7)
  let z = 0
  if (cone > 0.02) z = addCone(group, radius, cone, z, mats.tip)
  const body = Math.max(flute - cone, 0.05)
  const start = z
  z = addCyl(group, radius, body, z, mats.cutting)
  addFlutes(group, radius, body, start, drill.fluteCount, drill.helixAngle, mats.flute)
  const axial = Math.max(frustumHeight(drill.diameter, drill.chamferDiameter, drill.chamferAngle) * scale, 0.04)
  z = addFrustum(group, radius, chamferR, axial, z, mats.tip)
  addShank(group, drill, scale, z, mats)
}

function addFlat(group: THREE.Group, drill: DrillParams, scale: number, mats: DrillMaterials): void {
  const radius = (Math.max(drill.diameter, 0.2) * scale) / 2
  const hubD = Math.min(Math.max(drill.webThickness, drill.diameter * 0.12), drill.diameter * 0.4)
  const hubR = (hubD * scale) / 2
  const hubH = Math.max(pointConeHeight(hubD, 135) * scale, hubR * 0.6)
  let z = addCone(group, hubR, hubH, 0, mats.tip)
  z = addCyl(group, radius, Math.max(0.08, 0.3 * scale), z, mats.tip, 28)
  const flute = Math.max(drill.fluteLength, 0.4) * scale
  const start = z
  z = addCyl(group, radius, flute, z, mats.cutting)
  addFlutes(group, radius, flute, start, drill.fluteCount, drill.helixAngle, mats.flute)
  addShank(group, drill, scale, z, mats)
}

function addCore(group: THREE.Group, drill: DrillParams, scale: number, mats: DrillMaterials): void {
  const radius = (Math.max(drill.diameter, 0.4) * scale) / 2
  let z = 0
  if (drill.pointAngle >= 170) {
    z = addCyl(group, radius, Math.max(0.08, 0.25 * scale), z, mats.tip, 28)
    addCyl(group, radius * 0.42, Math.max(0.12, 0.4 * scale), 0.02, mats.hole, 16)
  } else {
    const cone = Math.min(pointConeHeight(drill.diameter, drill.pointAngle) * scale, radius * 1.4)
    z = addFrustum(group, radius * 0.55, radius, Math.max(cone, 0.05), z, mats.tip)
  }
  const flute = Math.max(drill.fluteLength, 0.4) * scale
  const start = z
  z = addCyl(group, radius, flute, z, mats.cutting)
  addFlutes(group, radius, flute, start, Math.max(drill.fluteCount, 3), drill.helixAngle, mats.flute, {
    groove: 1.25,
  })
  addShank(group, drill, scale, z, mats)
}

/** Approximate shop geometry for the live preview. Not a grind simulation. */
export function buildDrillMesh(
  group: THREE.Group,
  drill: DrillParams,
  scale: number,
  mats: DrillMaterials,
): void {
  switch (drill.drillType) {
    case 'jobber':
    case 'stub':
    case 'taper':
    case 'coolant':
    case 'straight':
    case 'micro':
      twistBody(group, drill, scale, mats)
      return
    case 'parabolic':
      twistBody(group, drill, scale, mats, { groove: 1.7, radial: 0.7 })
      return
    case 'double-margin':
      twistBody(group, drill, scale, mats, { doubleMargin: true })
      return
    case 'spot90':
    case 'spot120':
      addSpot(group, drill, scale, mats)
      return
    case 'center':
      addCenter(group, drill, scale, mats)
      return
    case 'step':
      addStep(group, drill, scale, mats)
      return
    case 'subland':
      addSubland(group, drill, scale, mats)
      return
    case 'gun':
      addGun(group, drill, scale, mats)
      return
    case 'countersink':
      addCountersink(group, drill, scale, mats)
      return
    case 'flat-bottom':
      addFlat(group, drill, scale, mats)
      return
    case 'core':
      addCore(group, drill, scale, mats)
      return
    default: {
      const exhaustive: never = drill.drillType
      void exhaustive
    }
  }
}
