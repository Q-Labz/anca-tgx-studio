import { frustumHeight, pointConeHeight } from '../lib/drillMath'
import type { PreviewPart } from '../lib/drillGuide'
import type { DrillParams, WebThinningStyle } from '../lib/types'

/** How much of the finished drill the mesh should show. The designer uses the finished reveal. */
export interface DrillReveal {
  /** 0 is a solid body. 1 is a fully open flute. */
  fluteOpen: number
  point: boolean
  clearance: boolean
  steps: boolean
  chamfer: boolean
  coolant: boolean
  driver: boolean
  /** Oversized round blank, before the diameter is ground. */
  stock: boolean
  /** Force a flat cutting face (resharpen face grind, or a flat-bottom tool). */
  flatFace: boolean
  wear: boolean
  /** Web-thinning notches on the point. */
  gash: boolean
  /** Millimetres removed from the flute, with the point kept. */
  shortenMm: number
}

export const FINISHED_REVEAL: DrillReveal = {
  fluteOpen: 1,
  point: true,
  clearance: true,
  steps: true,
  chamfer: true,
  coolant: true,
  driver: true,
  stock: false,
  flatFace: false,
  wear: false,
  gash: true,
  shortenMm: 0,
}

export type FluteFamily = 'twist' | 'parabolic' | 'double' | 'gun' | 'gun-v'

export type SpanKind = 'point' | 'cutting' | 'shank'

export interface MeshSpan {
  z0: number
  z1: number
  r0: number
  r1: number
  parts: PreviewPart[]
  blend: boolean
  kind: SpanKind
}

export interface CoolantPath {
  count: number
  radius: number
  z0: number
  z1: number
  /** Single gun-drill hole down the axis. Twist drills follow the helix. */
  axial: boolean
}

export interface DrillMeshPlan {
  spans: MeshSpan[]
  /** World-unit z where the point ends and the body flute is open. */
  coneH: number
  fluteEnd: number
  fluteCount: number
  family: FluteFamily
  helixTwist: number
  webTip: number
  webOuter: number
  marginFrac: number
  clearanceDrop: number
  chisel: number
  notch: WebThinningStyle
  coolant: CoolantPath | null
  /** z where a gun-drill driver flat begins. Null when the shank stays round. */
  driverStart: number | null
  /** Open center on a core drill, world radius. */
  coreHole: number | null
  fluteOpen: number
  stock: boolean
  wear: boolean
}

const TAU = Math.PI * 2

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function clamp01(n: number): number {
  return clamp(n, 0, 1)
}

export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function smoothstep(t: number): number {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

function wrapAngle(theta: number): number {
  const t = theta % TAU
  return t < 0 ? t + TAU : t
}

/**
 * Radians of helix over the flute. Lead comes from the helix angle and diameter,
 * and a long flute is capped so the preview does not wind into a knot.
 */
export function helixTwistRadians(helixDeg: number, fluteLengthMm: number, diameterMm: number): number {
  const helixRad = (Math.max(helixDeg, 0) * Math.PI) / 180
  const realDia = Math.max(diameterMm, 0.5)
  const realFluteLen = Math.max(fluteLengthMm, 0.5)
  return Math.min((2 * realFluteLen * Math.tan(helixRad)) / realDia, Math.PI * 4)
}

/** Land width as a fraction of one flute sector. */
export function marginFraction(marginWidthMm: number, diameterMm: number, fluteCount: number): number {
  const count = Math.max(1, fluteCount)
  const arc = (Math.PI * Math.max(diameterMm, 0.2)) / count
  if (!(marginWidthMm > 0) || !(arc > 0)) return 0.08
  return clamp(marginWidthMm / arc, 0.045, 0.28)
}

export function webRadii(
  webMm: number,
  diameterMm: number,
  notch: WebThinningStyle,
): { tip: number; outer: number } {
  const radius = Math.max(diameterMm, 0.2) / 2
  const outer = clamp(Math.max(webMm, 0) / 2, radius * 0.08, radius * 0.72)
  const factor = notchFactor(notch)
  return { tip: outer * factor, outer }
}

function notchFactor(notch: WebThinningStyle): number {
  switch (notch) {
    case 'none':
      return 1
    case 'S':
      return 0.78
    case 'X':
      return 0.66
    case 'split':
      return 0.58
    case 'notched':
      return 0.5
    default: {
      const neverStyle: never = notch
      return neverStyle
    }
  }
}

function notchDepth(notch: WebThinningStyle): number {
  switch (notch) {
    case 'none':
      return 0
    case 'S':
      return 0.16
    case 'X':
      return 0.26
    case 'split':
      return 0.32
    case 'notched':
      return 0.36
    default: {
      const neverStyle: never = notch
      return neverStyle
    }
  }
}

/**
 * Split, X, S, or notched web thinning. Returns a radius scale (1 = untouched)
 * for a groove just behind each lip, near the chisel.
 */
export function pointNotch(
  theta: number,
  fluteCount: number,
  notch: WebThinningStyle,
  z: number,
  coneH: number,
): number {
  const depth = notchDepth(notch)
  if (depth <= 0 || !(coneH > 0) || z > coneH * 0.62) return 1
  const count = Math.max(1, fluteCount)
  const sector = TAU / count
  const u = (wrapAngle(theta) % sector) / sector
  const strength = 1 - smoothstep(z / (coneH * 0.5))
  const width = notch === 'S' ? 0.05 : 0.07
  const hit = (center: number) => {
    const raw = Math.abs(u - center)
    const d = Math.min(raw, 1 - raw)
    return d < width ? 1 - d / width : 0
  }
  let cut = hit(0.1)
  if (notch === 'X') cut = Math.max(cut, hit(0.42))
  if (notch === 'notched') cut = Math.max(cut, hit(0.22))
  return 1 - strength * depth * cut
}

function gunRadius(
  theta: number,
  fluteCount: number,
  outer: number,
  floor: number,
  open: number,
  vShape: boolean,
  clearance: number,
): number {
  const count = Math.max(1, fluteCount)
  const sector = TAU / count
  const local = wrapAngle(theta) % sector
  const mid = sector / 2
  const half = sector * (vShape ? 0.2 : 0.32)
  const margin = Math.min(sector * 0.1, 0.22)
  const d = Math.abs(local - mid)
  if (d > half) {
    const fromLip = d - half
    if (fromLip < margin) return outer
    return outer - clearance
  }
  const t = 1 - d / Math.max(half, 1e-4)
  const shape = vShape ? t * t : Math.sin((t * Math.PI) / 2) ** 0.85
  return Math.max(floor, mix(outer, floor, shape * open))
}

function gulletRadius(
  u: number,
  outer: number,
  web: number,
  open: number,
  clearance: number,
  wide: boolean,
): number {
  const flankEnd = wide ? 0.06 : 0.08
  const fluteEnd = wide ? 0.9 : 0.8
  const heel = wide ? 0.96 : 0.9
  const body = outer - clearance
  if (u < flankEnd) {
    const t = u / Math.max(flankEnd, 1e-4)
    return outer - clearance * t * t
  }
  if (u <= fluteEnd) {
    const t = (u - flankEnd) / Math.max(fluteEnd - flankEnd, 1e-4)
    const dip = Math.sin(t * Math.PI) ** (wide ? 0.65 : 0.82)
    return Math.max(web, mix(body, mix(outer * 0.88, web, open), dip))
  }
  if (u < heel) {
    const t = smoothstep((u - fluteEnd) / Math.max(heel - fluteEnd, 1e-4))
    return mix(mix(body, web, 0.1), body, t)
  }
  const t = smoothstep((u - heel) / Math.max(1 - heel, 1e-4))
  return mix(body, outer, t)
}

/**
 * Radius at one angle. Margin stays on the cutting diameter, the gullet is a
 * smooth flute down to the web, and the heel sits at body clearance.
 * `fluteOpen` 0 is a round bar. 1 is the finished flute.
 */
export function stationRadius(
  theta: number,
  fluteCount: number,
  outerR: number,
  webR: number,
  marginFrac: number,
  fluteOpen: number,
  family: FluteFamily,
  clearanceDrop: number,
): number {
  const outer = Math.max(outerR, 1e-5)
  const open = clamp01(fluteOpen)
  if (open <= 0.001) return outer
  const clearance = Math.max(0, clearanceDrop) * open
  if (family === 'gun' || family === 'gun-v') {
    const floor = clamp(Math.max(webR, outer * 0.46), outer * 0.28, outer * 0.74)
    return gunRadius(theta, fluteCount, outer, floor, open, family === 'gun-v', clearance)
  }

  const count = Math.max(2, fluteCount)
  const web = clamp(webR, outer * 0.05, outer * 0.9)
  const sector = TAU / count
  const u = (wrapAngle(theta) % sector) / sector
  const margin = clamp(marginFrac, 0.045, 0.24)
  const wide = family === 'parabolic'

  if (family === 'double') {
    const second = margin * 0.8
    const gap0 = margin + 0.035
    const gap1 = gap0 + 0.1
    const land2 = gap1 + second
    if (u <= margin) return outer
    if (u < gap0) return mix(outer, outer - clearance, smoothstep((u - margin) / Math.max(gap0 - margin, 1e-4)))
    if (u < gap1) {
      const t = (u - gap0) / Math.max(gap1 - gap0, 1e-4)
      const dip = Math.sin(t * Math.PI)
      return Math.max(web, mix(outer - clearance, mix(outer * 0.9, web, 0.45), dip * open))
    }
    if (u <= land2) return outer
    return gulletRadius((u - land2) / Math.max(1 - land2, 1e-4), outer, web, open, clearance, wide)
  }

  if (family === 'twist' || family === 'parabolic') {
    if (u <= margin) return outer
    return gulletRadius((u - margin) / Math.max(1 - margin, 1e-4), outer, web, open, clearance, wide)
  }

  const neverFamily: never = family
  return neverFamily
}

/** How open the flute is at z. The chisel stays closed; the body runs out into the shank. */
export function fluteOpenAt(z: number, coneH: number, fluteEnd: number, target: number): number {
  const openTarget = clamp01(target)
  if (openTarget <= 0) return 0
  const solid = Math.max(coneH * 0.36, 0)
  const span = Math.max(coneH * 0.5, 1e-4)
  let open = coneH < 1e-4 ? openTarget : smoothstep((z - solid) / span) * openTarget
  const body = Math.max(fluteEnd - coneH, 1e-4)
  const runout = Math.min(body * 0.12, Math.max(body * 0.04, 1e-4))
  if (fluteEnd > coneH && z > fluteEnd - runout) {
    open *= 1 - smoothstep((z - (fluteEnd - runout)) / Math.max(runout, 1e-4))
  }
  return open
}

export function spanRadius(z: number, z0: number, z1: number, r0: number, r1: number, blend: boolean): number {
  const span = Math.max(z1 - z0, 1e-6)
  const u = clamp01((z - z0) / span)
  return mix(r0, r1, blend ? smoothstep(u) : u)
}

export function coatingHex(coating: string, material: 'carbide' | 'HSS'): number {
  const name = coating.trim().toLowerCase()
  if (name.includes('ticn')) return 0x6e5640
  if (name.includes('altin') || name.includes('tialn') || name.includes('alcrn')) return 0x2c2a34
  if (name.includes('tin')) return 0xe1b33a
  if (name.includes('diamond') || name.includes('dlc') || name.includes('amorphous')) return 0x1c1c20
  if (name.includes('uncoated') || name.includes('none') || name === '') {
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
  const name = coating.trim().toLowerCase()
  if (name.includes('tin') && !name.includes('altin') && !name.includes('tialn') && !name.includes('ticn')) {
    return { roughness: 0.16, clearcoat: 0.55, clearcoatRoughness: 0.16, metalness: 0.98 }
  }
  if (name.includes('altin') || name.includes('tialn') || name.includes('alcrn')) {
    return { roughness: 0.28, clearcoat: 0.32, clearcoatRoughness: 0.28, metalness: 0.96 }
  }
  if (name.includes('diamond') || name.includes('dlc') || name.includes('amorphous')) {
    return { roughness: 0.2, clearcoat: 0.68, clearcoatRoughness: 0.12, metalness: 0.9 }
  }
  if (name.includes('ticn')) {
    return { roughness: 0.22, clearcoat: 0.4, clearcoatRoughness: 0.22, metalness: 0.96 }
  }
  return { roughness: 0.24, clearcoat: 0.22, clearcoatRoughness: 0.32, metalness: 0.94 }
}

function familyOf(drill: DrillParams): FluteFamily {
  switch (drill.drillType) {
    case 'parabolic':
      return 'parabolic'
    case 'double-margin':
      return 'double'
    case 'gun':
      return drill.gunFluteStyle === 'v' || drill.fluteCount >= 2 ? 'gun-v' : 'gun'
    case 'jobber':
    case 'stub':
    case 'taper':
    case 'spot90':
    case 'spot120':
    case 'center':
    case 'step':
    case 'subland':
    case 'coolant':
    case 'straight':
    case 'micro':
    case 'countersink':
    case 'flat-bottom':
    case 'core':
      return 'twist'
    default: {
      const neverType: never = drill.drillType
      return neverType
    }
  }
}

function fluteCountOf(drill: DrillParams, family: FluteFamily): number {
  if (family === 'gun') return 1
  if (family === 'gun-v') return 2
  if (drill.drillType === 'core') return clamp(Math.round(drill.fluteCount) || 3, 3, 4)
  const count = Math.round(drill.fluteCount) || 2
  return clamp(count, 2, 6)
}

interface DraftSpan {
  length: number
  r0: number
  r1: number
  parts: PreviewPart[]
  blend: boolean
  kind: SpanKind
}

function push(spans: DraftSpan[], length: number, r0: number, r1: number, parts: PreviewPart[], blend: boolean, kind: SpanKind) {
  if (!(length > 0)) return
  spans.push({ length, r0: Math.max(r0, 1e-4), r1: Math.max(r1, 1e-4), parts, blend, kind })
}

function cuttingParts(extra: PreviewPart[]): PreviewPart[] {
  return ['flute', 'margin', ...extra]
}

function stockDiameter(drill: DrillParams): number {
  let size = Math.max(drill.diameter, drill.shankDiameter)
  for (const step of drill.steps) size = Math.max(size, step.diameter)
  switch (drill.drillType) {
    case 'subland':
      return Math.max(size, drill.sublandDiameter)
    case 'center':
      return Math.max(size, drill.countersinkDiameter)
    case 'countersink':
      return Math.max(size, drill.chamferDiameter)
    case 'jobber':
    case 'stub':
    case 'taper':
    case 'spot90':
    case 'spot120':
    case 'step':
    case 'coolant':
    case 'parabolic':
    case 'gun':
    case 'straight':
    case 'micro':
    case 'flat-bottom':
    case 'core':
    case 'double-margin':
      return size
    default: {
      const neverType: never = drill.drillType
      return neverType
    }
  }
}

function blendLength(deltaRadius: number, scale: number): number {
  return clamp(Math.abs(deltaRadius) * 0.9, 0.35 * scale, 1.5 * scale)
}

function addShank(spans: DraftSpan[], endRadius: number, drill: DrillParams, scale: number): void {
  const shankR = Math.max(drill.shankDiameter, 0.2) * scale * 0.5
  const shankLen = Math.max(drill.shankLength, 4) * scale
  const step = Math.abs(shankR - endRadius)
  let neck = 0
  if (step > endRadius * 0.03) {
    neck = Math.min(blendLength(step, scale), shankLen * 0.22)
    push(spans, neck, endRadius, shankR, ['shank'], true, 'shank')
  }
  const chamfer = Math.min(shankR * 0.16, 0.7 * scale, Math.max(shankLen - neck, 0) * 0.12)
  const main = Math.max(shankLen - neck - chamfer, shankR * 0.4)
  push(spans, main, shankR, shankR, ['shank'], false, 'shank')
  if (chamfer > 0.002) {
    push(spans, chamfer, shankR, shankR * 0.84, ['shank'], true, 'shank')
  }
}

function reflow(spans: DraftSpan[], scale: number, shortenMm: number): MeshSpan[] {
  const lengths = spans.map((span) => span.length)
  let budget = Math.max(0, shortenMm) * scale
  for (let i = 0; i < spans.length && budget > 0; i++) {
    if (spans[i].kind !== 'cutting') continue
    const cut = Math.min(budget, lengths[i] * 0.75)
    lengths[i] = Math.max(lengths[i] - cut, 0.02 * scale)
    budget -= cut
  }
  let z = 0
  return spans.map((span, index) => {
    const length = Math.max(lengths[index], 1e-4)
    const mesh: MeshSpan = {
      z0: z,
      z1: z + length,
      r0: span.r0,
      r1: span.r1,
      parts: span.parts,
      blend: span.blend,
      kind: span.kind,
    }
    z += length
    return mesh
  })
}

function pointParts(notch: WebThinningStyle): PreviewPart[] {
  return notch === 'none' ? ['point'] : ['point', 'web']
}

/**
 * Section plan in world units (millimetres × scale). The loft uses this so the
 * designer and the grind sim share one drill.
 */
export function planDrill(drill: DrillParams, scale: number, reveal: DrillReveal): DrillMeshPlan {
  const family = familyOf(drill)
  const fluteCount = fluteCountOf(drill, family)
  const notch: WebThinningStyle = reveal.gash ? drill.webThinning : 'none'
  const webs = webRadii(drill.webThickness, Math.max(drill.diameter, 0.2), notch)
  const marginFrac = marginFraction(drill.marginWidth, Math.max(drill.diameter, 0.2), fluteCount)
  const clearanceDrop = reveal.clearance
    ? Math.max(drill.bodyClearance / 2, drill.diameter * 0.012) * scale
    : 0
  const cuttingR = Math.max(drill.diameter, 0.05) * scale * 0.5
  const chisel = Math.max(cuttingR * 0.045, webs.tip * scale * 0.35)
  const helixMm = drill.drillType === 'step'
    ? Math.max(drill.fluteLength, drill.steps.reduce((sum, step) => sum + step.length, 0))
    : drill.fluteLength
  const helixTwist = helixTwistRadians(drill.helixAngle, helixMm, Math.max(drill.diameter, 0.5))

  const drafts: DraftSpan[] = []
  const wantFlat =
    reveal.flatFace || drill.drillType === 'flat-bottom' || (drill.drillType === 'core' && drill.pointAngle >= 170)
  const core = drill.drillType === 'core'
  const coreHole = core ? cuttingR * 0.36 : null

  if (reveal.stock) {
    const stockR = stockDiameter(drill) * scale * 0.5 * 1.06
    const flute = Math.max(drill.fluteLength, drill.diameter) * scale
    push(drafts, flute, stockR, stockR, ['flute'], false, 'cutting')
  } else if (wantFlat && !core) {
    const hubMm = clamp(Math.max(drill.webThickness, drill.diameter * 0.12), drill.diameter * 0.1, drill.diameter * 0.4)
    const hubR = (hubMm * scale) / 2
    const hubH = Math.max(pointConeHeight(hubMm, 135) * scale, hubR * 0.45)
    push(drafts, hubH, chisel, hubR, pointParts(notch), false, 'point')
    push(drafts, Math.max(cuttingR * 0.05, 0.04 * scale), hubR, cuttingR, ['point'], true, 'point')
    appendBody(drafts, drill, scale, reveal, cuttingR)
  } else if (core) {
    const hole = coreHole ?? cuttingR * 0.36
    if (wantFlat || !reveal.point) {
      push(drafts, Math.max(0.2 * scale, cuttingR * 0.04), hole, cuttingR, ['point'], true, 'point')
    } else {
      const cone = Math.max(pointConeHeight(drill.diameter, drill.pointAngle) * scale, cuttingR * 0.2)
      push(drafts, cone, hole, cuttingR, ['point'], false, 'point')
    }
    appendBody(drafts, drill, scale, reveal, cuttingR)
  } else if (!reveal.point) {
    appendBody(drafts, drill, scale, reveal, cuttingR)
  } else {
    appendPointed(drafts, drill, scale, reveal, chisel)
  }

  const spanned = reflow(drafts, scale, reveal.stock ? 0 : reveal.shortenMm)
  const coneH = spanned.filter((span) => span.kind === 'point').reduce((end, span) => Math.max(end, span.z1), 0)
  const cuttingEnd = spanned.filter((span) => span.kind !== 'shank').reduce((end, span) => Math.max(end, span.z1), 0)
  const endRadius = [...spanned].reverse().find((span) => span.kind !== 'shank')?.r1 ?? cuttingR
  const withShank = reflow(
    [
      ...spanned.map((span) => ({
        length: span.z1 - span.z0,
        r0: span.r0,
        r1: span.r1,
        parts: span.parts,
        blend: span.blend,
        kind: span.kind,
      })),
    ],
    scale,
    0,
  )
  // Shank is added after shorten so length removal does not eat the shank.
  const shankDrafts: DraftSpan[] = withShank.map((span) => ({
    length: span.z1 - span.z0,
    r0: span.r0,
    r1: span.r1,
    parts: span.parts,
    blend: span.blend,
    kind: span.kind,
  }))
  addShank(shankDrafts, endRadius, drill, scale)
  const spans = reflow(shankDrafts, scale, 0)
  const fluteEnd = spans.filter((span) => span.kind !== 'shank').reduce((end, span) => Math.max(end, span.z1), 0)
  const shankStart = spans.find((span) => span.kind === 'shank')?.z0 ?? fluteEnd
  const shankEnd = spans.reduce((end, span) => Math.max(end, span.z1), 0)
  const holes = Math.max(0, Math.round(drill.coolantHoles))
  const showCoolant = reveal.coolant && !reveal.stock && holes > 0
  const axial = family === 'gun' || family === 'gun-v' || holes === 1
  const holeR = clamp(
    (Math.max(drill.coolantHoleDiameter, drill.diameter * 0.08) * scale) / 2,
    cuttingR * 0.04,
    cuttingR * 0.22,
  )

  return {
    spans,
    coneH: coneH || cuttingEnd * 0.08,
    fluteEnd,
    fluteCount,
    family,
    helixTwist,
    webTip: webs.tip * scale,
    webOuter: webs.outer * scale,
    marginFrac,
    clearanceDrop,
    chisel,
    notch,
    coolant: showCoolant
      ? {
          count: axial ? 1 : holes,
          radius: holeR,
          z0: Math.max(coneH * 0.45, chisel),
          z1: fluteEnd,
          axial,
        }
      : null,
    driverStart: drill.drillType === 'gun' && reveal.driver ? mix(shankStart, shankEnd, 0.45) : null,
    coreHole,
    fluteOpen: reveal.stock ? 0 : clamp01(reveal.fluteOpen),
    stock: reveal.stock,
    wear: reveal.wear && !reveal.stock,
  }
}

function appendPointed(
  spans: DraftSpan[],
  drill: DrillParams,
  scale: number,
  reveal: DrillReveal,
  chisel: number,
) {
  const type = drill.drillType
  if (type === 'center') {
    appendCenter(spans, drill, scale, reveal, chisel)
    return
  }
  if (type === 'step') {
    appendSteps(spans, drill, scale, reveal, chisel)
    return
  }
  if (type === 'subland') {
    appendSubland(spans, drill, scale, reveal, chisel)
    return
  }
  if (type === 'countersink') {
    appendCountersink(spans, drill, scale, reveal, chisel)
    return
  }
  const radius = Math.max(drill.diameter, 0.05) * scale * 0.5
  const flute = Math.max(drill.fluteLength, drill.diameter * 0.4) * scale
  let cone = pointConeHeight(drill.diameter, drill.pointAngle) * scale
  if (!(cone > 0)) cone = radius * 0.12
  cone = Math.min(cone, flute * 0.86)
  push(spans, cone, chisel, radius, pointParts(reveal.gash ? drill.webThinning : 'none'), false, 'point')
  const body = Math.max(flute - cone, radius * 0.35)
  const back = (Math.max(drill.backTaper, 0) / 2) * ((body / scale) / 100) * scale
  push(spans, body, radius, Math.max(radius - back, radius * 0.94), cuttingParts([]), false, 'cutting')
}

function appendBody(
  spans: DraftSpan[],
  drill: DrillParams,
  scale: number,
  reveal: DrillReveal,
  radius: number,
) {
  const flute = Math.max(drill.fluteLength, drill.diameter * 0.5) * scale
  if (drill.drillType === 'step') {
    if (reveal.steps && drill.steps.length > 0) {
      appendStepCylinders(spans, drill, scale, 0)
      return
    }
    const big = Math.max(drill.diameter, ...drill.steps.map((step) => step.diameter), 0.05)
    const stockR = big * scale * 0.5
    push(spans, flute, stockR, stockR, cuttingParts(['step']), false, 'cutting')
    return
  }
  if (drill.drillType === 'countersink' && reveal.chamfer) {
    push(spans, flute, radius, radius, cuttingParts([]), false, 'cutting')
    const mouth = Math.max(drill.chamferDiameter, drill.diameter) * scale * 0.5
    const axial = Math.max(frustumHeight(drill.diameter, drill.chamferDiameter, drill.chamferAngle) * scale, 0.4 * scale)
    push(spans, axial, radius, mouth, ['chamfer', 'flute', 'margin'], true, 'cutting')
    return
  }
  push(spans, flute, radius, radius, cuttingParts([]), false, 'cutting')
}

function appendStepCylinders(spans: DraftSpan[], drill: DrillParams, scale: number, coneAlready: number) {
  const steps = drill.steps.length > 0 ? drill.steps : [{ diameter: drill.diameter, length: drill.fluteLength }]
  steps.forEach((step, index) => {
    const radius = Math.max(step.diameter, 0.05) * scale * 0.5
    const raw = Math.max(step.length, 0.2) * scale
    const length = index === 0 ? Math.max(raw - coneAlready, radius * 0.3) : raw
    if (index > 0) {
      const prev = Math.max(steps[index - 1].diameter, 0.05) * scale * 0.5
      push(spans, blendLength(radius - prev, scale), prev, radius, ['step', 'flute', 'margin'], true, 'cutting')
    }
    push(spans, length, radius, radius, index === 0 ? cuttingParts(['step']) : ['step', 'flute', 'margin'], false, 'cutting')
  })
}

function appendSteps(
  spans: DraftSpan[],
  drill: DrillParams,
  scale: number,
  reveal: DrillReveal,
  chisel: number,
) {
  const steps = reveal.steps && drill.steps.length > 0
    ? drill.steps
    : [{ diameter: Math.max(drill.diameter, ...drill.steps.map((step) => step.diameter)), length: Math.max(drill.fluteLength, 1) }]
  const first = steps[0]
  const radius = Math.max(first.diameter, 0.05) * scale * 0.5
  const raw = Math.max(first.length, 0.4) * scale
  let cone = reveal.point ? pointConeHeight(first.diameter, drill.pointAngle) * scale : 0
  if (reveal.point && !(cone > 0)) cone = radius * 0.1
  cone = Math.min(cone, raw * 0.72)
  if (cone > 0) push(spans, cone, chisel, radius, pointParts(reveal.gash ? drill.webThinning : 'none'), false, 'point')
  push(spans, Math.max(raw - cone, radius * 0.25), radius, radius, cuttingParts(['step']), false, 'cutting')
  for (let index = 1; index < steps.length; index++) {
    const step = steps[index]
    const next = Math.max(step.diameter, 0.05) * scale * 0.5
    const prev = Math.max(steps[index - 1].diameter, 0.05) * scale * 0.5
    push(spans, blendLength(next - prev, scale), prev, next, ['step', 'flute', 'margin'], true, 'cutting')
    push(spans, Math.max(step.length, 0.2) * scale, next, next, ['step', 'flute', 'margin'], false, 'cutting')
  }
}

function appendSubland(
  spans: DraftSpan[],
  drill: DrillParams,
  scale: number,
  reveal: DrillReveal,
  chisel: number,
) {
  const front = Math.max(drill.diameter, 0.05) * scale * 0.5
  const rear = Math.max(drill.sublandDiameter, drill.diameter) * scale * 0.5
  const frontLen = Math.max(drill.fluteLength, drill.diameter * 0.4) * scale
  if (!reveal.steps) {
    let cone = pointConeHeight(drill.sublandDiameter, drill.pointAngle) * scale
    cone = Math.min(Math.max(cone, rear * 0.1), frontLen * 0.4)
    push(spans, cone, chisel, rear, pointParts(reveal.gash ? drill.webThinning : 'none'), false, 'point')
    push(spans, Math.max(frontLen - cone, rear), rear, rear, cuttingParts(['step']), false, 'cutting')
    return
  }
  let cone = pointConeHeight(drill.diameter, drill.pointAngle) * scale
  cone = Math.min(Math.max(cone, front * 0.08), frontLen * 0.7)
  push(spans, cone, chisel, front, pointParts(reveal.gash ? drill.webThinning : 'none'), false, 'point')
  push(spans, Math.max(frontLen - cone, front * 0.3), front, front, cuttingParts([]), false, 'cutting')
  push(spans, blendLength(rear - front, scale), front, rear, ['step', 'flute', 'margin'], true, 'cutting')
  push(spans, Math.max(drill.sublandLength, 0.4) * scale, rear, rear, ['step', 'flute', 'margin'], false, 'cutting')
}

function appendCenter(
  spans: DraftSpan[],
  drill: DrillParams,
  scale: number,
  reveal: DrillReveal,
  chisel: number,
) {
  const pilot = Math.max(drill.diameter, 0.05) * scale * 0.5
  const mouth = Math.max(drill.countersinkDiameter, drill.diameter) * scale * 0.5
  const pilotLen = Math.max(drill.pilotLength, drill.diameter * 0.35) * scale
  let cone = pointConeHeight(drill.diameter, drill.pointAngle) * scale
  cone = Math.min(Math.max(cone, pilot * 0.15), pilotLen * 0.7)
  push(spans, cone, chisel, pilot, pointParts(reveal.gash ? drill.webThinning : 'none'), false, 'point')
  push(spans, Math.max(pilotLen - cone, pilot * 0.25), pilot, pilot, cuttingParts([]), false, 'cutting')
  if (reveal.chamfer) {
    const axial = Math.max(
      frustumHeight(drill.diameter, drill.countersinkDiameter, drill.countersinkAngle) * scale,
      0.35 * scale,
    )
    push(spans, axial, pilot, mouth, ['chamfer', 'flute', 'margin'], true, 'cutting')
  }
}

function appendCountersink(
  spans: DraftSpan[],
  drill: DrillParams,
  scale: number,
  reveal: DrillReveal,
  chisel: number,
) {
  const radius = Math.max(drill.diameter, 0.05) * scale * 0.5
  const flute = Math.max(drill.fluteLength, drill.diameter * 0.4) * scale
  let cone = pointConeHeight(drill.diameter, drill.pointAngle) * scale
  cone = Math.min(Math.max(cone, radius * 0.1), flute * 0.75)
  push(spans, cone, chisel, radius, pointParts(reveal.gash ? drill.webThinning : 'none'), false, 'point')
  push(spans, Math.max(flute - cone, radius * 0.3), radius, radius, cuttingParts([]), false, 'cutting')
  if (reveal.chamfer) {
    const mouth = Math.max(drill.chamferDiameter, drill.diameter) * scale * 0.5
    const axial = Math.max(frustumHeight(drill.diameter, drill.chamferDiameter, drill.chamferAngle) * scale, 0.35 * scale)
    push(spans, axial, radius, mouth, ['chamfer', 'flute', 'margin'], true, 'cutting')
  }
}
