import type { DrillParams, EndmillParams, ToolType } from './types'

export const PREVIEW_SCALE = 0.12

export interface ToolLayout {
  diameter: number
  shankDiameter: number
  overallLength: number
  fluteLength: number
  fluteCount: number
  helixDeg: number
  pointAngleDeg: number | null
  cornerRadius: number
  squareCapHeight: number
  coneHeight: number
  neckDiameter: number | null
  neckLength: number | null
  extraBodyLength: number
  effectiveShankHeight: number
  totalLength: number
  helixTwist: number
}

export function helixTwistRadians(
  helixDeg: number,
  fluteLengthMm: number,
  diameterMm: number,
): number {
  const helixRad = (helixDeg * Math.PI) / 180
  const realDia = Math.max(diameterMm, 0.5)
  const realFluteLen = Math.max(fluteLengthMm, 0.5)
  return Math.min((2 * realFluteLen * Math.tan(helixRad)) / realDia, Math.PI * 4)
}

export function layoutTool(
  toolType: ToolType,
  params: EndmillParams | DrillParams,
): ToolLayout {
  const scale = PREVIEW_SCALE
  const diameter = Math.max(params.diameter, 0.5) * scale
  const shankDiameter = Math.max(params.shankDiameter, 0.5) * scale
  const overallLength = Math.max(params.overallLength, 1) * scale
  const fluteLength =
    Math.min(params.fluteLength, params.overallLength - 0.5) * scale
  const shankLength = Math.min(params.shankLength, params.overallLength) * scale
  const maxFlutes = toolType === 'drill' ? 3 : 8
  const fluteCount = Math.max(2, Math.min(maxFlutes, params.fluteCount | 0))

  let helixDeg: number
  if (toolType === 'endmill') {
    const h = (params as EndmillParams).helixAngle
    helixDeg = Number.isFinite(h) ? h : 30
  } else {
    helixDeg = 30
  }

  let z = 0
  let cornerRadius = 0
  let squareCapHeight = 0
  let coneHeight = 0
  let pointAngleDeg: number | null = null

  if (toolType === 'drill') {
    const drill = params as DrillParams
    pointAngleDeg = Number.isFinite(drill.pointAngle) ? drill.pointAngle : 118
    const half = ((pointAngleDeg as number) * Math.PI) / 180 / 2
    coneHeight = Math.max(diameter / 2 / Math.tan(half), diameter * 0.05)
    z += coneHeight
  } else {
    const em = params as EndmillParams
    const cr = Math.min(Math.max(em.cornerRadius, 0), params.diameter / 2) * scale
    if (cr > 0.001) {
      cornerRadius = cr
      z += cr
    } else {
      squareCapHeight = Math.max(diameter * 0.06, 0.05)
      z += squareCapHeight
    }
  }

  z += fluteLength

  let neckDiameter: number | null = null
  let neckLength: number | null = null
  let neckAdded = false
  if (toolType === 'endmill') {
    const em = params as EndmillParams
    if (em.neckDiameter != null && em.neckLength != null && em.neckLength > 0) {
      neckDiameter = Math.max(em.neckDiameter, 0.3) * scale
      neckLength = em.neckLength * scale
      z += neckLength
      neckAdded = true
    }
  }

  let effectiveShankHeight = Math.max(shankLength, diameter * 0.4)
  let extraBodyLength = 0
  const gap = overallLength - z - effectiveShankHeight
  if (gap > 0.001) {
    if (neckAdded) {
      effectiveShankHeight += gap
    } else {
      extraBodyLength = gap
      z += gap
    }
  }

  const realFluteLenMm = Math.max(
    Math.min(params.fluteLength, params.overallLength - 0.5),
    0.5,
  )

  return {
    diameter,
    shankDiameter,
    overallLength,
    fluteLength,
    fluteCount,
    helixDeg,
    pointAngleDeg,
    cornerRadius,
    squareCapHeight,
    coneHeight,
    neckDiameter,
    neckLength,
    extraBodyLength,
    effectiveShankHeight,
    totalLength: z + effectiveShankHeight,
    helixTwist: helixTwistRadians(helixDeg, realFluteLenMm, params.diameter),
  }
}
