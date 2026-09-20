import * as THREE from 'three'
import type { ToolMaterial } from './types'

export type TipShape = 'cone' | 'square' | 'bull'

export interface FlutedToolOptions {
  radius: number
  length: number
  fluteCount: number
  twist: number
  tipLength: number
  tipShape: TipShape
  cornerRadius: number
  /** Web / core as a fraction of radius at the shank end of the flutes. */
  webOuterFrac: number
  /** Web fraction at the tip (smaller = web thinning). */
  webTipFrac: number
  /** Thin OD land as a fraction of each flute sector. */
  marginFrac: number
  radialSegs?: number
  lengthSegs?: number
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/**
 * Polar outline of one station: margin at OD, circular-ish gullets down to the
 * web, and a slight body-clearance step behind each land.
 */
export function profileRadius(
  theta: number,
  fluteCount: number,
  outerR: number,
  webR: number,
  marginFrac: number,
): number {
  const n = Math.max(2, fluteCount)
  const sector = (Math.PI * 2) / n
  const local = ((theta % sector) + sector) % sector
  const u = local / sector
  const web = Math.min(Math.max(webR, outerR * 0.04), outerR * 0.92)
  const clearance = outerR * 0.97
  const m = Math.min(Math.max(marginFrac, 0.04), 0.22)
  const fluteStart = m + 0.05
  const fluteEnd = 0.78
  const heel = 0.9

  if (u <= m) return outerR
  if (u < fluteStart) {
    const t = smoothstep((u - m) / (fluteStart - m))
    return mix(outerR, web, t * 0.35 + 0.05)
  }
  if (u <= fluteEnd) {
    const t = (u - fluteStart) / (fluteEnd - fluteStart)
    // Circular gullet: deepest at mid-flute, fillets at both lips.
    const dip = Math.sin(t * Math.PI)
    const r = mix(clearance, web, dip)
    return Math.max(web, r)
  }
  if (u < heel) {
    const t = smoothstep((u - fluteEnd) / (heel - fluteEnd))
    return mix(mix(clearance, web, 0.15), clearance, t)
  }
  const t = smoothstep((u - heel) / (1 - heel))
  return mix(clearance, outerR, t)
}

/**
 * Twist-drill station: cutting lip + margin at OD, primary relief facet, then
 * a helical gullet. `fluteOpen` 0 is a nearly solid point (two ground faces);
 * 1 is the full body flute.
 */
export function drillStationRadius(
  theta: number,
  fluteCount: number,
  outerR: number,
  webR: number,
  marginFrac: number,
  fluteOpen: number,
): number {
  const n = Math.max(2, fluteCount)
  const sector = (Math.PI * 2) / n
  const local = ((theta % sector) + sector) % sector
  const u = local / sector
  const web = Math.min(Math.max(webR, outerR * 0.05), outerR * 0.9)
  const open = Math.min(Math.max(fluteOpen, 0), 1)
  const land = Math.min(Math.max(marginFrac, 0.055), 0.16)
  const lipW = mix(0.02, land, open)
  const flankEnd = mix(0.9, land + 0.08, open)
  const fluteEnd = mix(0.965, 0.8, open)

  if (u <= lipW) return outerR

  if (u < flankEnd) {
    const t = (u - lipW) / Math.max(flankEnd - lipW, 1e-4)
    const drop = mix(0.032, 0.075, open) * t * t
    return outerR * (1 - drop)
  }

  if (u < fluteEnd) {
    const t = (u - flankEnd) / Math.max(fluteEnd - flankEnd, 1e-4)
    const dip = Math.pow(Math.sin(t * Math.PI), 0.82)
    const deep = mix(outerR * 0.86, web, open)
    const shallow = mix(outerR * 0.97, outerR * 0.93, open)
    return Math.max(web, mix(shallow, deep, dip))
  }

  const t = smoothstep((u - fluteEnd) / Math.max(1 - fluteEnd, 1e-4))
  const heel = outerR * mix(0.965, 0.97, open)
  return mix(heel, outerR, t)
}

export function envelopeRadius(
  z: number,
  radius: number,
  tipLength: number,
  tipShape: TipShape,
  cornerRadius: number,
): number {
  if (tipShape === 'cone') {
    const h = Math.max(tipLength, radius * 0.08)
    const chisel = radius * 0.05
    return Math.max(chisel, Math.min(radius, (z / h) * radius))
  }
  if (tipShape === 'bull' && cornerRadius > 0.001) {
    const cr = Math.min(cornerRadius, radius)
    if (z >= cr) return radius
    const flat = Math.max(radius - cr, 0)
    const dz = cr - z
    return flat + Math.sqrt(Math.max(0, cr * cr - dz * dz))
  }
  if (tipShape === 'square' || tipShape === 'bull') return radius
  const _exhaustive: never = tipShape
  return _exhaustive
}

export function webAt(z: number, length: number, tipWeb: number, outerWeb: number): number {
  const t = smoothstep(z / Math.max(length * 0.4, 0.001))
  return mix(tipWeb, outerWeb, t)
}

export function createFlutedToolGeometry(opts: FlutedToolOptions): THREE.BufferGeometry {
  const radialSegs = Math.max(48, opts.radialSegs ?? 120)
  const lengthSegs = Math.max(24, opts.lengthSegs ?? 100)
  const length = Math.max(opts.length, 0.05)
  const radius = Math.max(opts.radius, 0.01)
  const n = Math.max(2, opts.fluteCount)
  const blend = Math.min(length * 0.12, radius * 1.2)

  const cols = radialSegs
  const rows = lengthSegs + 1
  const ringCount = rows
  const vertCount = ringCount * cols + 2
  const positions = new Float32Array(vertCount * 3)
  const colors = new Float32Array(vertCount * 3)
  const uvs = new Float32Array(vertCount * 2)

  const set = (idx: number, x: number, y: number, z: number, shade: number, u: number, v: number) => {
    positions[idx * 3] = x
    positions[idx * 3 + 1] = y
    positions[idx * 3 + 2] = z
    colors[idx * 3] = shade
    colors[idx * 3 + 1] = shade
    colors[idx * 3 + 2] = shade
    uvs[idx * 2] = u
    uvs[idx * 2 + 1] = v
  }

  for (let i = 0; i < rows; i++) {
    const t = i / lengthSegs
    const tipSpan = opts.tipLength > 0.001 ? Math.min(0.4, opts.tipLength / length + 0.06) : 0.1
    const tipZ = Math.max(opts.tipLength, 0)
    const z =
      t <= tipSpan
        ? (t / Math.max(tipSpan, 0.0001)) * (tipZ || length * 0.08)
        : (tipZ || length * 0.08) +
          ((t - tipSpan) / Math.max(1 - tipSpan, 0.0001)) * (length - (tipZ || length * 0.08))
    const twist = (z / length) * opts.twist
    const env = envelopeRadius(z, radius, opts.tipLength, opts.tipShape, opts.cornerRadius)
    const rawWeb = webAt(z, length, radius * opts.webTipFrac, radius * opts.webOuterFrac)
    // Only drills keep a solid envelope at the point. Endmills stay open
    // through the cutting end so the gullets read in the end view.
    const tipProtect =
      opts.tipShape === 'cone' && opts.tipLength > 0.001
        ? 1 - smoothstep(z / Math.max(opts.tipLength * 1.35, 0.001))
        : 0
    const web = Math.min(env * 0.95, mix(rawWeb, env * 0.72, tipProtect))
    const fade =
      z > length - blend ? smoothstep((z - (length - blend)) / Math.max(blend, 0.0001)) : 0
    let tipOpen = 1
    if (opts.tipShape === 'cone' && opts.tipLength > 0.001) {
      tipOpen = smoothstep((z - opts.tipLength * 0.12) / Math.max(opts.tipLength * 0.88, 0.001))
    }

    for (let j = 0; j < cols; j++) {
      const theta0 = (j / cols) * Math.PI * 2
      const pr = profileRadius(theta0, n, env, web, opts.marginFrac)
      const r = mix(env, pr, tipOpen * (1 - fade))
      const a = theta0 + twist
      const shade = r > env * 0.978 ? 1 : mix(0.52, 0.9, r / Math.max(env, 1e-4))
      // Recess gullets just behind the end teeth so the flutes show as
      // openings instead of a flat cap.
      const gashT =
        opts.tipShape === 'cone'
          ? 0
          : 1 - smoothstep(z / Math.max(radius * 0.28, opts.cornerRadius * 0.9, 0.01))
      const gash = gashT * (1 - r / Math.max(env, 1e-4)) * radius * 0.16
      set(i * cols + j, Math.cos(a) * r, Math.sin(a) * r, z + gash, shade, j / cols, z / length)
    }
  }

  const frontCenter = ringCount * cols
  const backCenter = frontCenter + 1
  set(frontCenter, 0, 0, 0, 0.82, 0.5, 0)
  set(backCenter, 0, 0, length, 0.78, 0.5, 1)

  const indices: number[] = []
  for (let i = 0; i < lengthSegs; i++) {
    for (let j = 0; j < cols; j++) {
      const jn = (j + 1) % cols
      const a = i * cols + j
      const b = i * cols + jn
      const c = (i + 1) * cols + jn
      const d = (i + 1) * cols + j
      indices.push(a, b, c, a, c, d)
    }
  }
  for (let j = 0; j < cols; j++) {
    const jn = (j + 1) % cols
    indices.push(frontCenter, jn, j)
    const b = lengthSegs * cols
    indices.push(backCenter, b + j, b + jn)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

export interface TwistDrillOptions {
  radius: number
  fluteLength: number
  coneHeight: number
  fluteCount: number
  twist: number
  webOuterFrac: number
  webTipFrac: number
  marginFrac: number
  splitPoint: boolean
  radialSegs?: number
  lengthSegs?: number
}

/**
 * Single-body twist drill: conical envelope, chisel, cutting lips, primary
 * relief facets, then helical gullets / margins. No separate cone overlay.
 */
export function createTwistDrillGeometry(opts: TwistDrillOptions): THREE.BufferGeometry {
  const radialSegs = Math.max(64, opts.radialSegs ?? 168)
  const lengthSegs = Math.max(40, opts.lengthSegs ?? 150)
  const radius = Math.max(opts.radius, 0.01)
  const coneH = Math.max(opts.coneHeight, radius * 0.2)
  const fluteLen = Math.max(opts.fluteLength, 0.05)
  const length = coneH + fluteLen
  const n = Math.max(2, opts.fluteCount)
  const blend = Math.min(fluteLen * 0.14, radius * 1.15)
  const chisel = radius * 0.045
  const cols = radialSegs
  const rows = lengthSegs + 1
  const vertCount = rows * cols + 2
  const positions = new Float32Array(vertCount * 3)
  const colors = new Float32Array(vertCount * 3)
  const uvs = new Float32Array(vertCount * 2)

  const set = (idx: number, x: number, y: number, z: number, shade: number, u: number, v: number) => {
    positions[idx * 3] = x
    positions[idx * 3 + 1] = y
    positions[idx * 3 + 2] = z
    colors[idx * 3] = shade
    colors[idx * 3 + 1] = shade
    colors[idx * 3 + 2] = shade
    uvs[idx * 2] = u
    uvs[idx * 2 + 1] = v
  }

  for (let i = 0; i < rows; i++) {
    const t = i / lengthSegs
    // Spend ~42% of the rings on the point so lips / chisel stay sharp.
    const z = t <= 0.42 ? (t / 0.42) * coneH : coneH + ((t - 0.42) / 0.58) * fluteLen
    const env = z <= coneH ? Math.max(chisel, (z / coneH) * radius) : radius
    const rawWeb = webAt(z, length, radius * opts.webTipFrac, radius * opts.webOuterFrac)
    const web = Math.min(env * 0.92, rawWeb)
    const solid = Math.max(coneH * 0.22, radius * 0.24)
    const openSpan = Math.max(coneH * 0.72, radius * 0.5)
    const fluteOpen = smoothstep((z - solid) / openSpan)
    const twist = (z / length) * opts.twist
    const fade =
      z > length - blend ? smoothstep((z - (length - blend)) / Math.max(blend, 0.0001)) : 0

    for (let j = 0; j < cols; j++) {
      const theta0 = (j / cols) * Math.PI * 2
      let r = drillStationRadius(theta0, n, env, web, opts.marginFrac, fluteOpen)
      // Hold a solid cone through the first part of the point so the two
      // helical lands meet at one chisel instead of forking.
      const core = 1 - smoothstep((z - coneH * 0.42) / Math.max(coneH * 0.34, 0.001))
      r = mix(r, env, core)
      if (opts.splitPoint && z < coneH * 0.3) {
        const sector = (Math.PI * 2) / n
        const u = (((theta0 % sector) + sector) % sector) / sector
        const strength = 1 - smoothstep(z / Math.max(coneH * 0.3, 0.001))
        const mid = Math.abs(u - 0.5)
        if (mid < 0.12) {
          r *= 1 - strength * 0.22 * (1 - mid / 0.12)
        }
      }
      r = mix(r, env, fade)
      r = Math.min(env, Math.max(chisel * 0.65, r))
      const a = theta0 + twist
      const land = r > env * 0.978
      const shade = land ? 1 : mix(0.48, 0.88, r / Math.max(env, 1e-4))
      set(i * cols + j, Math.cos(a) * r, Math.sin(a) * r, z, shade, j / cols, z / length)
    }
  }

  const frontCenter = rows * cols
  const backCenter = frontCenter + 1
  set(frontCenter, 0, 0, 0, 0.7, 0.5, 0)
  set(backCenter, 0, 0, length, 0.76, 0.5, 1)

  const indices: number[] = []
  for (let i = 0; i < lengthSegs; i++) {
    for (let j = 0; j < cols; j++) {
      const jn = (j + 1) % cols
      const a = i * cols + j
      const b = i * cols + jn
      const c = (i + 1) * cols + jn
      const d = (i + 1) * cols + j
      indices.push(a, b, c, a, c, d)
    }
  }
  for (let j = 0; j < cols; j++) {
    const jn = (j + 1) % cols
    indices.push(frontCenter, jn, j)
    const b = lengthSegs * cols
    indices.push(backCenter, b + j, b + jn)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

export function coatingHex(coating: string, material: ToolMaterial): number {
  const c = coating.trim().toLowerCase()
  if (c.includes('ticn')) return 0x6e5640
  if (c.includes('altin') || c.includes('tialn') || c.includes('alcrn')) return 0x2c2a34
  if (c.includes('tin')) return 0xe1b33a
  if (c.includes('diamond') || c.includes('dlc') || c.includes('amorphous')) return 0x1c1c20
  if (c.includes('uncoated') || c.includes('none') || c === '') {
    return material === 'carbide' ? 0xc8cdd3 : 0xc4a45a
  }
  return material === 'carbide' ? 0xc8cdd3 : 0xc4a45a
}

export interface CoatingLook {
  roughness: number
  clearcoat: number
  clearcoatRoughness: number
  metalness: number
}

export function coatingLook(coating: string): CoatingLook {
  const c = coating.trim().toLowerCase()
  if (c.includes('tin') && !c.includes('altin') && !c.includes('tialn') && !c.includes('ticn')) {
    return { roughness: 0.15, clearcoat: 0.58, clearcoatRoughness: 0.16, metalness: 0.98 }
  }
  if (c.includes('altin') || c.includes('tialn') || c.includes('alcrn')) {
    return { roughness: 0.26, clearcoat: 0.34, clearcoatRoughness: 0.28, metalness: 0.96 }
  }
  if (c.includes('diamond') || c.includes('dlc') || c.includes('amorphous')) {
    return { roughness: 0.2, clearcoat: 0.7, clearcoatRoughness: 0.12, metalness: 0.9 }
  }
  if (c.includes('ticn')) {
    return { roughness: 0.22, clearcoat: 0.4, clearcoatRoughness: 0.22, metalness: 0.96 }
  }
  return { roughness: 0.24, clearcoat: 0.22, clearcoatRoughness: 0.32, metalness: 0.94 }
}

export function substrateHex(material: ToolMaterial): number {
  return material === 'carbide' ? 0xc8cdd4 : 0xb8a070
}
