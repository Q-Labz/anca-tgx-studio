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
  const positions = new Float32Array((ringCount * cols + 2) * 3)

  const set = (idx: number, x: number, y: number, z: number) => {
    positions[idx * 3] = x
    positions[idx * 3 + 1] = y
    positions[idx * 3 + 2] = z
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
    const web = Math.min(
      env * 0.95,
      webAt(z, length, radius * opts.webTipFrac, radius * opts.webOuterFrac),
    )
    const fade =
      z > length - blend ? smoothstep((z - (length - blend)) / Math.max(blend, 0.0001)) : 0
    // Keep the tip a solid envelope (cone / bull / face) and open the
    // gullets behind it so the point does not split into separate lobes.
    let tipOpen = 1
    if (opts.tipShape === 'cone' && opts.tipLength > 0.001) {
      tipOpen = smoothstep((z - opts.tipLength * 0.12) / Math.max(opts.tipLength * 0.88, 0.001))
    } else if (opts.tipShape === 'bull' && opts.cornerRadius > 0.001) {
      tipOpen = smoothstep(z / Math.max(opts.cornerRadius * 0.8, 0.001))
    } else if (opts.tipShape === 'square') {
      tipOpen = smoothstep(z / Math.max(radius * 0.16, 0.01))
    }

    for (let j = 0; j < cols; j++) {
      const theta0 = (j / cols) * Math.PI * 2
      const pr = profileRadius(theta0, n, env, web, opts.marginFrac)
      const r = mix(env, pr, tipOpen * (1 - fade))
      const a = theta0 + twist
      set(i * cols + j, Math.cos(a) * r, Math.sin(a) * r, z)
    }
  }

  const frontCenter = ringCount * cols
  const backCenter = frontCenter + 1
  set(frontCenter, 0, 0, 0)
  set(backCenter, 0, 0, length)

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
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

export function coatingHex(coating: string, material: ToolMaterial): number {
  const c = coating.trim().toLowerCase()
  if (c.includes('ticn')) return 0x6b5340
  if (c.includes('altin') || c.includes('tialn') || c.includes('alcrn')) return 0x3c3a46
  if (c.includes('tin')) return 0xd4a017
  if (c.includes('diamond') || c.includes('dlc') || c.includes('amorphous')) return 0x222226
  if (c.includes('uncoated') || c.includes('none') || c === '') {
    return material === 'carbide' ? 0xc5ccd3 : 0xb89a58
  }
  return material === 'carbide' ? 0xc5ccd3 : 0xb89a58
}

export function substrateHex(material: ToolMaterial): number {
  return material === 'carbide' ? 0xc8cdd4 : 0xb8a070
}
