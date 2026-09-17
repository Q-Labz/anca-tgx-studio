import type { DrillParams, EndmillParams, ToolType } from './types'

export type FieldErrors = Record<string, string>

function req(n: number, min: number, max: number, label: string): string | null {
  if (Number.isNaN(n)) return `${label} is required`
  if (n < min || n > max) return `${label} must be ${min}–${max}`
  return null
}

export function validateEndmill(p: EndmillParams): FieldErrors {
  const e: FieldErrors = {}
  if (!p.name.trim()) e.name = 'Name is required'
  const checks: [keyof EndmillParams, number, number, number, string][] = [
    ['diameter', p.diameter, 0.1, 50, 'Diameter (mm)'],
    ['fluteCount', p.fluteCount, 2, 8, 'Flute count'],
    ['helixAngle', p.helixAngle, 0, 60, 'Helix angle (°)'],
    ['overallLength', p.overallLength, 1, 300, 'Overall length (mm)'],
    ['fluteLength', p.fluteLength, 0.5, 200, 'Flute length (mm)'],
    ['shankDiameter', p.shankDiameter, 0.1, 50, 'Shank diameter (mm)'],
    ['shankLength', p.shankLength, 1, 200, 'Shank length (mm)'],
    ['cornerRadius', p.cornerRadius, 0, 25, 'Corner radius (mm)'],
  ]
  for (const [key, val, min, max, label] of checks) {
    const err = req(val as number, min, max, label)
    if (err) e[key] = err
  }
  if (p.fluteLength >= p.overallLength) {
    e.fluteLength = 'Flute length must be less than overall length'
  }
  if (p.cornerRadius > p.diameter / 2) {
    e.cornerRadius = 'Corner radius cannot exceed half diameter'
  }
  if (p.neckDiameter != null) {
    const err = req(p.neckDiameter, 0.1, 50, 'Neck diameter (mm)')
    if (err) e.neckDiameter = err
    else if (p.neckDiameter > p.diameter) e.neckDiameter = 'Neck ≤ cutting diameter'
  }
  if (p.neckLength != null) {
    const err = req(p.neckLength, 0, 150, 'Neck length (mm)')
    if (err) e.neckLength = err
  }
  return e
}

export function validateDrill(p: DrillParams): FieldErrors {
  const e: FieldErrors = {}
  if (!p.name.trim()) e.name = 'Name is required'
  const checks: [keyof DrillParams, number, number, number, string][] = [
    ['diameter', p.diameter, 0.1, 50, 'Diameter (mm)'],
    ['pointAngle', p.pointAngle, 60, 180, 'Point angle (°)'],
    ['fluteCount', p.fluteCount, 2, 3, 'Flute count'],
    ['overallLength', p.overallLength, 1, 400, 'Overall length (mm)'],
    ['fluteLength', p.fluteLength, 0.5, 300, 'Flute length (mm)'],
    ['shankDiameter', p.shankDiameter, 0.1, 50, 'Shank diameter (mm)'],
    ['shankLength', p.shankLength, 1, 200, 'Shank length (mm)'],
  ]
  for (const [key, val, min, max, label] of checks) {
    const err = req(val as number, min, max, label)
    if (err) e[key] = err
  }
  if (p.fluteLength >= p.overallLength) {
    e.fluteLength = 'Flute length must be less than overall length'
  }
  return e
}

export function validateTool(type: ToolType, params: EndmillParams | DrillParams): FieldErrors {
  return type === 'endmill'
    ? validateEndmill(params as EndmillParams)
    : validateDrill(params as DrillParams)
}
