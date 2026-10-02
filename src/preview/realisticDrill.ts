import * as THREE from 'three'
import type { DrillParams, EndmillParams } from '../lib/types'
import type { PreviewPart } from '../lib/drillGuide'
import {
  FINISHED_REVEAL,
  coatingHex,
  coatingLook,
  fluteOpenAt,
  mix,
  planDrill,
  pointNotch,
  smoothstep,
  spanRadius,
  stationRadius,
  helixTwistRadians,
  type DrillMeshPlan,
  type DrillReveal,
  type MeshSpan,
  type SpanKind,
} from './fluteProfile'

export interface DrillMeshOptions {
  quality?: 'preview' | 'sim'
  reveal?: DrillReveal
}

interface RingSample {
  r: number
  shade: number
  zShift: number
  twist: number
}

const TAU = Math.PI * 2

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function setAttr(
  positions: Float32Array,
  colors: Float32Array,
  uvs: Float32Array,
  index: number,
  x: number,
  y: number,
  z: number,
  shade: number,
  u: number,
  v: number,
) {
  positions[index * 3] = x
  positions[index * 3 + 1] = y
  positions[index * 3 + 2] = z
  colors[index * 3] = shade
  colors[index * 3 + 1] = shade
  colors[index * 3 + 2] = shade
  uvs[index * 2] = u
  uvs[index * 2 + 1] = v
}

function buildLoft(
  z0: number,
  z1: number,
  rows: number,
  cols: number,
  sample: (z: number, theta: number) => RingSample,
  capStart: boolean,
  capEnd: boolean,
): THREE.BufferGeometry {
  const rings = rows + 1
  const extra = (capStart ? 1 : 0) + (capEnd ? 1 : 0)
  const vertCount = rings * cols + extra
  const positions = new Float32Array(vertCount * 3)
  const colors = new Float32Array(vertCount * 3)
  const uvs = new Float32Array(vertCount * 2)
  const length = Math.max(z1 - z0, 1e-4)

  for (let i = 0; i < rings; i++) {
    const z = z0 + (length * i) / rows
    for (let j = 0; j < cols; j++) {
      const theta = (j / cols) * TAU
      const ring = sample(z, theta)
      const angle = theta + ring.twist
      setAttr(
        positions,
        colors,
        uvs,
        i * cols + j,
        Math.cos(angle) * ring.r,
        Math.sin(angle) * ring.r,
        z + ring.zShift,
        ring.shade,
        j / cols,
        (z - z0) / length,
      )
    }
  }

  const indices: number[] = []
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const jn = (j + 1) % cols
      const a = i * cols + j
      const b = i * cols + jn
      const c = (i + 1) * cols + jn
      const d = (i + 1) * cols + j
      indices.push(a, b, c, a, c, d)
    }
  }

  let cursor = rings * cols
  if (capStart) {
    setAttr(positions, colors, uvs, cursor, 0, 0, z0, 0.72, 0.5, 0)
    for (let j = 0; j < cols; j++) {
      indices.push(cursor, (j + 1) % cols, j)
    }
    cursor += 1
  }
  if (capEnd) {
    setAttr(positions, colors, uvs, cursor, 0, 0, z1, 0.78, 0.5, 1)
    const base = rows * cols
    for (let j = 0; j < cols; j++) {
      indices.push(cursor, base + j, base + ((j + 1) % cols))
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  creaseLands(geo)
  return geo
}

/** Push land normals outward so the margin catches the light instead of looking faceted. */
function creaseLands(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position')
  const norm = geo.getAttribute('normal')
  const color = geo.getAttribute('color')
  for (let i = 0; i < pos.count; i++) {
    if (color.getX(i) < 0.94) continue
    const x = pos.getX(i)
    const y = pos.getY(i)
    const len = Math.hypot(x, y)
    if (len < 1e-5) continue
    const k = 0.62
    const bx = norm.getX(i) * (1 - k) + (x / len) * k
    const by = norm.getY(i) * (1 - k) + (y / len) * k
    const bz = norm.getZ(i) * (1 - k)
    const mag = Math.hypot(bx, by, bz) || 1
    norm.setXYZ(i, bx / mag, by / mag, bz / mag)
  }
  norm.needsUpdate = true
}

function ringCount(length: number, radius: number, quality: 'preview' | 'sim', kind: SpanKind): number {
  const preview = quality === 'preview'
  if (length < Math.max(radius * 0.2, 0.02)) return preview ? 8 : 5
  const estimate = Math.round((length / Math.max(radius, 0.05)) * (preview ? 7 : 4))
  const min = kind === 'point' ? (preview ? 20 : 12) : preview ? 12 : 8
  const max = kind === 'point' ? (preview ? 40 : 22) : preview ? 64 : 36
  return clamp(estimate, min, max)
}

function outerAt(plan: DrillMeshPlan, z: number): number {
  const span = plan.spans.find((item) => z <= item.z1 + 1e-4) ?? plan.spans[plan.spans.length - 1]
  if (!span) return 0.1
  return spanRadius(z, span.z0, span.z1, span.r0, span.r1, span.blend)
}

function sampleCutting(plan: DrillMeshPlan, span: MeshSpan, z: number, theta: number): RingSample {
  const outer = spanRadius(z, span.z0, span.z1, span.r0, span.r1, span.blend)
  if (span.kind === 'shank') {
    let r = outer
    if (plan.driverStart != null && z >= plan.driverStart) {
      const c = Math.cos(theta)
      const limit = 0.62
      if (c > limit) r = Math.min(r, (limit * outer) / Math.max(c, 1e-3))
    }
    return { r, shade: 1, zShift: 0, twist: 0 }
  }

  const open = fluteOpenAt(z, plan.coneH, plan.fluteEnd, plan.fluteOpen)
  const fluteSpan = Math.max(plan.fluteEnd - plan.coneH * 0.2, 1e-4)
  const along = smoothstep(clamp((z - plan.coneH * 0.2) / fluteSpan, 0, 1))
  const webShank = Math.min(outer * 0.58, Math.max(plan.webOuter * 1.55, plan.webTip * 1.85))
  const web = Math.min(outer * 0.72, mix(plan.webTip, webShank, along))
  let r = stationRadius(
    theta,
    plan.fluteCount,
    outer,
    web,
    plan.marginFrac,
    open,
    plan.family,
    plan.clearanceDrop,
  )
  if (span.kind === 'point' && plan.coreHole == null) {
    const core = 1 - smoothstep((z - plan.coneH * 0.32) / Math.max(plan.coneH * 0.3, 1e-4))
    r = mix(r, outer, core)
    r *= pointNotch(theta, plan.fluteCount, plan.notch, z, plan.coneH)
  }
  r = Math.min(outer, Math.max(r, Math.min(plan.chisel * 0.65, outer)))
  if (plan.coreHole != null && span.kind === 'point') r = Math.max(r, plan.coreHole * 0.98)
  const land = r > outer * 0.96
  const shade = land ? 1 : mix(0.68, 0.93, r / Math.max(outer, 1e-4))
  const twist = (z / Math.max(plan.fluteEnd, 1e-4)) * plan.helixTwist
  return { r, shade, zShift: 0, twist }
}

function mark(mesh: THREE.Mesh, parts: readonly PreviewPart[]) {
  mesh.userData.parts = [...parts]
  mesh.userData.part = parts[0] ?? 'flute'
  mesh.userData.baseMaterial = mesh.material
}

function place(group: THREE.Group, geo: THREE.BufferGeometry, material: THREE.Material, parts: readonly PreviewPart[]) {
  const mesh = new THREE.Mesh(geo, material.clone())
  mark(mesh, parts)
  group.add(mesh)
}

function cuttingMaterial(coating: string, material: DrillParams['material'], stock: boolean): THREE.MeshPhysicalMaterial {
  const finish = stock
    ? { roughness: 0.48, clearcoat: 0.06, clearcoatRoughness: 0.45, metalness: 0.7 }
    : coatingLook(coating)
  return new THREE.MeshPhysicalMaterial({
    color: stock ? 0xd7c4a8 : coatingHex(coating, material),
    metalness: finish.metalness,
    roughness: finish.roughness,
    clearcoat: finish.clearcoat,
    clearcoatRoughness: finish.clearcoatRoughness,
    envMapIntensity: 0.34,
    vertexColors: true,
  })
}

function shankMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0x8e99a3,
    metalness: 0.5,
    roughness: 0.52,
    clearcoat: 0.02,
    clearcoatRoughness: 0.7,
    anisotropy: 0.32,
    envMapIntensity: 0.32,
  })
}

function holeMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0x0b0e12,
    metalness: 0.35,
    roughness: 0.72,
    clearcoat: 0.05,
  })
}

function addCoolant(group: THREE.Group, plan: DrillMeshPlan, material: THREE.Material) {
  const path = plan.coolant
  if (!path) return
  if (path.axial) {
    const length = Math.max(path.z1 - path.z0, 0.04)
    const geo = new THREE.CylinderGeometry(path.radius, path.radius, length, 20)
    const mesh = new THREE.Mesh(geo, material.clone())
    mesh.rotation.x = -Math.PI / 2
    mesh.position.z = path.z0 + length / 2
    mark(mesh, ['coolant'])
    group.add(mesh)
    const eye = new THREE.Mesh(new THREE.SphereGeometry(path.radius * 0.92, 18, 14), material.clone())
    eye.position.z = path.radius * 0.85
    mark(eye, ['coolant'])
    group.add(eye)
    return
  }

  const steps = 36
  for (let hole = 0; hole < path.count; hole++) {
    const points: THREE.Vector3[] = []
    for (let step = 0; step <= steps; step++) {
      const t = step / steps
      const z = mix(path.z0, path.z1, t)
      const outer = Math.max(outerAt(plan, z), path.radius * 2)
      const twist = (z / Math.max(plan.fluteEnd, 1e-4)) * plan.helixTwist
      const angle = (hole / path.count) * TAU + twist
      const radial = t < 0.16 ? mix(outer * 0.9, outer * 0.36, t / 0.16) : outer * 0.36
      points.push(new THREE.Vector3(Math.cos(angle) * radial, Math.sin(angle) * radial, z))
    }
    const curve = new THREE.CatmullRomCurve3(points)
    const geo = new THREE.TubeGeometry(curve, 48, path.radius, 8, false)
    const mesh = new THREE.Mesh(geo, material.clone())
    mark(mesh, ['coolant'])
    group.add(mesh)
  }
}

function rememberMetrics(group: THREE.Group, plan: DrillMeshPlan) {
  const tip = plan.spans.find((span) => span.kind !== 'shank')
  const end = plan.spans.reduce((z, span) => Math.max(z, span.z1), 0)
  group.userData.metrics = {
    tipZ: 0,
    tipRadius: tip?.r1 ?? plan.chisel,
    fluteStart: plan.coneH,
    fluteEnd: plan.fluteEnd,
    shoulderZ: plan.coneH + (plan.fluteEnd - plan.coneH) * 0.45,
    shankEnd: end,
  }
}

/** Lofted carbide drill: helical flutes, point, shank chamfer, and coolant path. */
export function buildDrillMesh(
  group: THREE.Group,
  drill: DrillParams,
  scale: number,
  options?: DrillMeshOptions,
): DrillMeshPlan {
  const quality = options?.quality ?? 'preview'
  const reveal = options?.reveal ?? FINISHED_REVEAL
  const plan = planDrill(drill, scale, reveal)
  const cols = quality === 'preview' ? 120 : 72
  const cutting = cuttingMaterial(drill.coating, drill.material, plan.stock)
  const shank = shankMaterial()
  const hole = holeMaterial()
  const first = plan.spans[0]

  for (const span of plan.spans) {
    const rows = ringCount(span.z1 - span.z0, Math.max(span.r0, span.r1), quality, span.kind)
    const radial = span.kind === 'shank' ? Math.round(cols * 0.7) : cols
    const capStart = span === first && plan.coreHole == null
    const geo = buildLoft(
      span.z0,
      span.z1,
      rows,
      radial,
      (z, theta) => sampleCutting(plan, span, z, theta),
      capStart,
      false,
    )
    place(group, geo, span.kind === 'shank' ? shank : cutting, span.parts)
  }

  const last = plan.spans[plan.spans.length - 1]
  if (last && last.kind === 'shank') {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(Math.max(last.r1, 1e-3), Math.round(cols * 0.7)), shank.clone())
    cap.position.z = last.z1
    mark(cap, ['shank'])
    group.add(cap)
  }

  if (plan.coreHole != null) {
    const disk = new THREE.Mesh(new THREE.CircleGeometry(plan.coreHole * 0.98, 24), hole.clone())
    disk.rotation.y = Math.PI
    disk.position.z = 0.001
    mark(disk, ['point'])
    group.add(disk)
  }

  addCoolant(group, plan, hole)
  if (plan.wear) {
    const wear = new THREE.MeshPhysicalMaterial({
      color: 0x8a5a3a,
      metalness: 0.35,
      roughness: 0.72,
    })
    const blob = new THREE.Mesh(new THREE.SphereGeometry(Math.max(plan.chisel * 2.4, 0.04), 18, 12), wear)
    blob.scale.z = 0.42
    blob.position.z = Math.max(plan.coneH * 0.2, 0.02)
    mark(blob, ['point'])
    group.add(blob)
  }

  cutting.dispose()
  shank.dispose()
  hole.dispose()
  rememberMetrics(group, plan)
  return plan
}

function endmillOuter(z: number, radius: number, corner: number): number {
  if (corner > 0.001 && z < corner) {
    const cr = Math.min(corner, radius)
    const flat = Math.max(radius - cr, 0)
    const dz = cr - z
    return flat + Math.sqrt(Math.max(0, cr * cr - dz * dz))
  }
  return radius
}

/** Open-ended endmill flutes, plus a chamfered shank. */
export function buildEndmillMesh(group: THREE.Group, params: EndmillParams, scale: number) {
  const radius = (Math.max(params.diameter, 0.5) * scale) / 2
  const fluteLen = Math.max(Math.min(params.fluteLength, params.overallLength - 0.5), 0.4) * scale
  const count = clamp(Math.round(params.fluteCount) || 4, 2, 8)
  const twist = helixTwistRadians(params.helixAngle, params.fluteLength, params.diameter)
  const corner = Math.min(Math.max(params.cornerRadius, 0), params.diameter / 2) * scale
  const cutting = cuttingMaterial(params.coating, params.material, false)
  const geo = buildLoft(
    0,
    fluteLen,
    56,
    112,
    (z, theta) => {
      const env = endmillOuter(z, radius, corner)
      const r = stationRadius(theta, count, env, env * 0.4, 0.07, 1, 'twist', env * 0.015)
      const gashT = 1 - smoothstep(z / Math.max(radius * 0.24, 0.01))
      const gash = gashT * (1 - r / Math.max(env, 1e-4)) * radius * 0.16
      return {
        r,
        shade: r > env * 0.97 ? 1 : mix(0.46, 0.9, r / Math.max(env, 1e-4)),
        zShift: gash,
        twist: (z / fluteLen) * twist,
      }
    },
    corner <= 0.001,
    false,
  )
  place(group, geo, cutting, ['flute', 'margin'])
  cutting.dispose()

  let z = fluteLen
  const shankMat = shankMaterial()
  if (params.neckDiameter != null && params.neckLength != null && params.neckLength > 0) {
    const neckR = (Math.max(params.neckDiameter, 0.3) * scale) / 2
    const neckL = params.neckLength * scale
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(neckR, neckR, neckL, 48), shankMat.clone())
    neck.rotation.x = -Math.PI / 2
    neck.position.z = z + neckL / 2
    mark(neck, ['shank'])
    group.add(neck)
    z += neckL
  }

  const shankR = (Math.max(params.shankDiameter, 0.5) * scale) / 2
  const shankLen = Math.max(params.shankLength, 4) * scale
  const chamfer = Math.min(shankR * 0.16, shankLen * 0.1)
  const main = Math.max(shankLen - chamfer, shankR)
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(shankR, shankR, main, 64), shankMat.clone())
  shank.rotation.x = -Math.PI / 2
  shank.position.z = z + main / 2
  mark(shank, ['shank'])
  group.add(shank)
  z += main
  if (chamfer > 0.002) {
    const bevel = new THREE.Mesh(
      new THREE.CylinderGeometry(shankR * 0.84, shankR, chamfer, 64),
      shankMat.clone(),
    )
    bevel.rotation.x = -Math.PI / 2
    bevel.position.z = z + chamfer / 2
    mark(bevel, ['shank'])
    group.add(bevel)
    z += chamfer
  }
  const cap = new THREE.Mesh(new THREE.CircleGeometry(shankR * 0.84, 64), shankMat.clone())
  cap.position.z = z
  mark(cap, ['shank'])
  group.add(cap)
  shankMat.dispose()
}
