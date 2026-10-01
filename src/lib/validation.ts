import { formatMm, frustumHeight, pointConeHeight } from './drillMath'
import { drillTypeShows, getDrillType, isDrillTypeId } from './drillTypes'
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

function checkRange(
  e: FieldErrors,
  key: string,
  value: number,
  min: number,
  max: number,
  label: string,
  custom?: string,
) {
  if (!Number.isFinite(value)) {
    e[key] = `${label} is required`
    return
  }
  if (value < min || value > max) {
    e[key] = custom ?? `${label} must be ${formatMm(min)}–${formatMm(max)}`
  }
}

function validateSteps(p: DrillParams, e: FieldErrors) {
  if (p.steps.length < 2) {
    e.steps = 'A step drill needs at least two diameters'
    return
  }
  if (p.steps.length > 6) {
    e.steps = 'Keep a step drill to 6 diameters or fewer'
    return
  }
  for (let i = 0; i < p.steps.length; i++) {
    const step = p.steps[i]
    if (!Number.isFinite(step.diameter) || step.diameter <= 0 || step.diameter > 50) {
      e[`step-${i}-diameter`] = `Step ${i + 1} diameter must be 0.1–50 mm`
    } else if (i > 0 && step.diameter <= p.steps[i - 1].diameter) {
      e[`step-${i}-diameter`] =
        `Step ${i + 1} (${formatMm(step.diameter)} mm) must be larger than step ${i} (${formatMm(p.steps[i - 1].diameter)} mm). Diameters grow from the tip.`
    }
    if (!Number.isFinite(step.length) || step.length <= 0 || step.length > 150) {
      e[`step-${i}-length`] = `Step ${i + 1} length must be 0.1–150 mm`
    }
  }
  const sum = p.steps.reduce((total, step) => total + (Number.isFinite(step.length) ? step.length : 0), 0)
  if (sum >= p.overallLength) {
    e.steps = `Step lengths add up to ${formatMm(sum)} mm, which has to be shorter than the overall length (${formatMm(p.overallLength)} mm)`
  }
  const cone = pointConeHeight(p.steps[0]?.diameter ?? 0, p.pointAngle)
  if (p.steps[0] && cone >= p.steps[0].length) {
    e.pointAngle = `Point cone is ${formatMm(cone)} mm, longer than step 1 (${formatMm(p.steps[0].length)} mm). Open the point angle or lengthen step 1.`
  }
  if (p.steps[0] && Math.abs(p.diameter - p.steps[0].diameter) > 0.05) {
    e.diameter = `Tip diameter (${formatMm(p.diameter)} mm) has to match step 1 (${formatMm(p.steps[0].diameter)} mm)`
  }
  if (Math.abs(p.fluteLength - sum) > 0.05) {
    e.fluteLength = `Flute length (${formatMm(p.fluteLength)} mm) has to equal the sum of the step lengths (${formatMm(sum)} mm)`
  }
}

function validateSubland(p: DrillParams, e: FieldErrors) {
  checkRange(e, 'sublandDiameter', p.sublandDiameter, 0.5, 50, 'Subland diameter (mm)')
  checkRange(e, 'sublandLength', p.sublandLength, 0.2, 200, 'Subland length (mm)')
  if (!e.sublandDiameter && !(p.sublandDiameter > p.diameter)) {
    e.sublandDiameter = `Subland diameter (${formatMm(p.sublandDiameter)} mm) must be larger than the front diameter (${formatMm(p.diameter)} mm)`
  }
  const shoulder = frustumHeight(p.diameter, p.sublandDiameter, p.pointAngle)
  const cutting = p.fluteLength + shoulder + p.sublandLength
  if (!e.sublandLength && cutting >= p.overallLength) {
    e.sublandLength = `Front land (${formatMm(p.fluteLength)} mm), point shoulder (${formatMm(shoulder)} mm), and subland (${formatMm(p.sublandLength)} mm) add up to ${formatMm(cutting)} mm, which has to be shorter than the overall length (${formatMm(p.overallLength)} mm)`
  }
}

function validateCenter(p: DrillParams, e: FieldErrors) {
  checkRange(e, 'countersinkDiameter', p.countersinkDiameter, 0.5, 30, 'Countersink diameter (mm)')
  checkRange(e, 'countersinkAngle', p.countersinkAngle, 50, 130, 'Countersink angle (°)')
  checkRange(e, 'pilotLength', p.pilotLength, 0.2, 40, 'Pilot length (mm)')
  if (!e.countersinkDiameter && !(p.countersinkDiameter > p.diameter)) {
    e.countersinkDiameter = `Countersink diameter (${formatMm(p.countersinkDiameter)} mm) must be larger than the pilot (${formatMm(p.diameter)} mm)`
  }
  const cone = pointConeHeight(p.diameter, p.pointAngle)
  if (!e.pilotLength && !e.pointAngle && cone >= p.pilotLength) {
    e.pointAngle = `Pilot point is ${formatMm(cone)} mm long, which is longer than the pilot (${formatMm(p.pilotLength)} mm). Open the point angle or lengthen the pilot.`
  }
  const countersink = frustumHeight(p.diameter, p.countersinkDiameter, p.countersinkAngle)
  if (!e.pilotLength && p.pilotLength + countersink >= p.overallLength) {
    e.pilotLength = `Pilot (${formatMm(p.pilotLength)} mm) plus the ${formatMm(countersink)} mm countersink must be shorter than the overall length (${formatMm(p.overallLength)} mm)`
  }
  if (!e.pilotLength && p.pilotLength > p.fluteLength + 0.05) {
    e.pilotLength = `Pilot length (${formatMm(p.pilotLength)} mm) cannot be longer than the flute length (${formatMm(p.fluteLength)} mm)`
  }
}

function validateChamfer(p: DrillParams, e: FieldErrors) {
  checkRange(e, 'chamferDiameter', p.chamferDiameter, 0.5, 40, 'Chamfer diameter (mm)')
  checkRange(e, 'chamferAngle', p.chamferAngle, 45, 140, 'Chamfer angle (°)')
  if (!e.chamferDiameter && !(p.chamferDiameter > p.diameter)) {
    e.chamferDiameter = `Chamfer diameter (${formatMm(p.chamferDiameter)} mm) must be larger than the drill diameter (${formatMm(p.diameter)} mm)`
  }
  const axial = frustumHeight(p.diameter, p.chamferDiameter, p.chamferAngle)
  if (!e.chamferDiameter && p.fluteLength + axial >= p.overallLength) {
    e.chamferDiameter = `Drill flute (${formatMm(p.fluteLength)} mm) plus the ${formatMm(axial)} mm chamfer must be shorter than the overall length (${formatMm(p.overallLength)} mm)`
  }
  if (!e.chamferDiameter && p.fluteLength + axial + p.shankLength > p.overallLength + 0.05) {
    e.chamferDiameter = `Flute (${formatMm(p.fluteLength)} mm), chamfer (${formatMm(axial)} mm), and shank (${formatMm(p.shankLength)} mm) add up to more than the overall length (${formatMm(p.overallLength)} mm)`
  }
}

function validateCoolant(p: DrillParams, e: FieldErrors) {
  const maxHoles = p.drillType === 'gun' ? 1 : 2
  if (!Number.isInteger(p.coolantHoles) || p.coolantHoles < 0 || p.coolantHoles > maxHoles) {
    e.coolantHoles =
      p.drillType === 'gun'
        ? 'A gun drill has one coolant hole down the center (or none).'
        : 'Coolant hole count must be a whole number from 0 to 2'
    return
  }
  if (p.coolantHoles <= 0) return
  checkRange(e, 'coolantHoleDiameter', p.coolantHoleDiameter, 0.05, 15, 'Coolant hole diameter (mm)')
  if (e.coolantHoleDiameter) return
  if (p.coolantHoles === 1) {
    if (p.coolantHoleDiameter >= p.diameter * 0.5) {
      e.coolantHoleDiameter = `Coolant hole (${formatMm(p.coolantHoleDiameter)} mm) must be smaller than half the drill diameter (${formatMm(p.diameter / 2)} mm)`
    }
    return
  }
  if (drillTypeShows(p.drillType, 'webThickness') && p.coolantHoleDiameter >= p.webThickness) {
    e.coolantHoleDiameter = `Each coolant hole (${formatMm(p.coolantHoleDiameter)} mm) has to be smaller than the web (${formatMm(p.webThickness)} mm)`
    return
  }
  if (p.coolantHoles * p.coolantHoleDiameter >= p.diameter * 0.7) {
    e.coolantHoleDiameter = `Coolant holes (${p.coolantHoles} × ${formatMm(p.coolantHoleDiameter)} mm) do not fit inside the ${formatMm(p.diameter)} mm cross-section`
  }
}

function validateWeb(p: DrillParams, e: FieldErrors) {
  const min = p.diameter * 0.05
  const max = p.diameter * 0.45
  if (!Number.isFinite(p.webThickness) || p.webThickness < min || p.webThickness > max) {
    e.webThickness = `Web thickness must be ${formatMm(min)}–${formatMm(max)} mm (5–45% of the ${formatMm(p.diameter)} mm diameter)`
  }
}

function validateMargin(p: DrillParams, e: FieldErrors) {
  const max = p.diameter * 0.2
  if (!Number.isFinite(p.marginWidth) || p.marginWidth < 0 || p.marginWidth > max) {
    e.marginWidth = `Margin width must be 0–${formatMm(max)} mm (at most 20% of diameter)`
  }
}

function validateBody(p: DrillParams, e: FieldErrors) {
  const max = p.diameter * 0.25
  if (!Number.isFinite(p.bodyClearance) || p.bodyClearance < 0 || p.bodyClearance >= max) {
    e.bodyClearance = `Body clearance must be 0–${formatMm(max)} mm so the body stays under the cutting diameter`
    return
  }
  if (drillTypeShows(p.drillType, 'webThickness')) {
    const body = p.diameter - p.bodyClearance
    if (body <= p.webThickness) {
      e.bodyClearance = `Body clearance leaves a ${formatMm(body)} mm body, which is not larger than the web (${formatMm(p.webThickness)} mm)`
    }
  }
}

function validateBackTaper(p: DrillParams, e: FieldErrors) {
  if (!Number.isFinite(p.backTaper) || p.backTaper < 0 || p.backTaper > 0.5) {
    e.backTaper = 'Back taper must be 0–0.5 mm per 100 mm of flute'
    return
  }
  if (!drillTypeShows(p.drillType, 'webThickness')) return
  const drop = p.backTaper * (p.fluteLength / 100)
  const body = p.diameter - (Number.isFinite(p.bodyClearance) ? p.bodyClearance : 0) - drop
  if (body <= p.webThickness) {
    e.backTaper = `Back taper removes ${formatMm(drop)} mm over the flute and cuts the body down to the web (${formatMm(p.webThickness)} mm)`
  }
}

export function validateDrill(p: DrillParams): FieldErrors {
  const e: FieldErrors = {}
  if (!isDrillTypeId(p.drillType)) {
    e.drillType = 'Pick a drill type from the library'
    return e
  }
  const def = getDrillType(p.drillType)
  if (!p.name.trim()) e.name = 'Name is required'

  const custom = def.messages
  checkRange(e, 'diameter', p.diameter, def.limits.diameter.min, def.limits.diameter.max, 'Diameter (mm)', custom?.diameter)
  checkRange(
    e,
    'pointAngle',
    p.pointAngle,
    def.limits.pointAngle.min,
    def.limits.pointAngle.max,
    'Point angle (°)',
    custom?.pointAngle,
  )
  checkRange(
    e,
    'fluteCount',
    p.fluteCount,
    def.limits.fluteCount.min,
    def.limits.fluteCount.max,
    'Flute count',
    custom?.fluteCount,
  )
  if (!e.fluteCount && !Number.isInteger(p.fluteCount)) {
    e.fluteCount = 'Flute count must be a whole number'
  }
  checkRange(
    e,
    'helixAngle',
    p.helixAngle,
    def.limits.helixAngle.min,
    def.limits.helixAngle.max,
    'Helix angle (°)',
    custom?.helixAngle,
  )
  checkRange(
    e,
    'overallLength',
    p.overallLength,
    def.limits.overallLength.min,
    def.limits.overallLength.max,
    'Overall length (mm)',
  )
  checkRange(
    e,
    'fluteLength',
    p.fluteLength,
    def.limits.fluteLength.min,
    def.limits.fluteLength.max,
    'Flute length (mm)',
  )
  checkRange(
    e,
    'shankDiameter',
    p.shankDiameter,
    def.limits.shankDiameter.min,
    def.limits.shankDiameter.max,
    'Shank diameter (mm)',
  )
  checkRange(
    e,
    'shankLength',
    p.shankLength,
    def.limits.shankLength.min,
    def.limits.shankLength.max,
    'Shank length (mm)',
  )

  if (!e.fluteLength && p.fluteLength >= p.overallLength) {
    e.fluteLength = `Flute length (${formatMm(p.fluteLength)} mm) must be shorter than the overall length (${formatMm(p.overallLength)} mm)`
  }
  if (!e.shankLength && p.shankLength >= p.overallLength) {
    e.shankLength = `Shank length (${formatMm(p.shankLength)} mm) must be shorter than the overall length (${formatMm(p.overallLength)} mm)`
  }
  if (!e.fluteLength && !e.shankLength && p.fluteLength + p.shankLength > p.overallLength + 0.05) {
    e.fluteLength = `Flute length (${formatMm(p.fluteLength)} mm) plus shank length (${formatMm(p.shankLength)} mm) is longer than the overall length (${formatMm(p.overallLength)} mm)`
  }

  if (p.drillType !== 'step' && p.drillType !== 'center' && !e.pointAngle && !e.fluteLength) {
    const cone = pointConeHeight(p.diameter, p.pointAngle)
    if (cone >= p.fluteLength) {
      e.pointAngle = `Point cone is ${formatMm(cone)} mm, which is longer than the flute (${formatMm(p.fluteLength)} mm). Open the point angle or lengthen the flute.`
    }
  }

  if (drillTypeShows(p.drillType, 'webThickness')) validateWeb(p, e)
  if (drillTypeShows(p.drillType, 'marginWidth')) validateMargin(p, e)
  if (drillTypeShows(p.drillType, 'bodyClearance')) validateBody(p, e)
  if (drillTypeShows(p.drillType, 'backTaper')) validateBackTaper(p, e)
  if (drillTypeShows(p.drillType, 'lipReliefAngle')) {
    checkRange(e, 'lipReliefAngle', p.lipReliefAngle, 0, 30, 'Lip relief (°)')
  }
  if (drillTypeShows(p.drillType, 'coolantHoles')) validateCoolant(p, e)
  if (drillTypeShows(p.drillType, 'steps')) validateSteps(p, e)
  if (drillTypeShows(p.drillType, 'sublandDiameter')) validateSubland(p, e)
  if (drillTypeShows(p.drillType, 'centerSize')) validateCenter(p, e)
  if (drillTypeShows(p.drillType, 'chamferDiameter')) validateChamfer(p, e)

  return e
}

export function validateTool(type: ToolType, params: EndmillParams | DrillParams): FieldErrors {
  return type === 'endmill'
    ? validateEndmill(params as EndmillParams)
    : validateDrill(params as DrillParams)
}
