import type { DrillParams, DrillTypeId } from './types'
import type { WheelDuty } from './wheelPacks'

export type GrindMode = 'make' | 'resharpen'

/** Geometry the educational scene is allowed to show after an operation. */
export const GRIND_STAGES = [
  'blank',
  'od',
  'flute',
  'clearance',
  'gash',
  'point',
  'secondary',
  'step',
  'chamfer',
  'face',
  'coolant',
  'driver',
  'wear',
  'length',
] as const

export type GrindStage = (typeof GRIND_STAGES)[number]

export type GrindDuty = WheelDuty | 'inspect' | 'blank-feature'

export type GrindFamily = 'twist' | 'step' | 'subland' | 'center' | 'countersink' | 'flat' | 'core' | 'gun'

export interface GrindOp {
  id: string
  title: string
  narration: string
  detail: string
  forms: string
  duty: GrindDuty
  stage: GrindStage
  /** Features visible once this operation has finished. */
  show: GrindStage[]
}

export interface GrindSequence {
  mode: GrindMode
  stockRemovedMm: number
  initialShow: GrindStage[]
  operations: GrindOp[]
}

export interface GrindVisual {
  family: GrindFamily
  diameter: number
  shankDiameter: number
  overallLength: number
  fluteLength: number
  pointAngle: number
  fluteCount: number
  helixAngle: number
  steps: { diameter: number; length: number }[]
  sublandDiameter: number
  sublandLength: number
  chamferAngle: number
  chamferDiameter: number
  countersinkAngle: number
  countersinkDiameter: number
  pilotLength: number
  coolantHoles: number
  stockMm: number
}

interface OpDraft {
  id: string
  title: string
  narration: string
  detail: string
  forms: string
  duty: GrindDuty
  stage: GrindStage
}

export function clampStockMm(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  return Math.min(5, Math.max(0.05, Math.round(value * 100) / 100))
}

export function grindFamily(id: DrillTypeId): GrindFamily {
  switch (id) {
    case 'step':
      return 'step'
    case 'subland':
      return 'subland'
    case 'center':
      return 'center'
    case 'countersink':
      return 'countersink'
    case 'flat-bottom':
      return 'flat'
    case 'core':
      return 'core'
    case 'gun':
      return 'gun'
    case 'jobber':
    case 'stub':
    case 'taper':
    case 'spot90':
    case 'spot120':
    case 'coolant':
    case 'parabolic':
    case 'straight':
    case 'micro':
    case 'double-margin':
      return 'twist'
    default: {
      const neverType: never = id
      return neverType
    }
  }
}

export function grindVisual(drill: DrillParams, stockMm: number): GrindVisual {
  return {
    family: grindFamily(drill.drillType),
    diameter: drill.diameter,
    shankDiameter: drill.shankDiameter,
    overallLength: drill.overallLength,
    fluteLength: drill.fluteLength,
    pointAngle: drill.pointAngle,
    fluteCount: drill.fluteCount,
    helixAngle: drill.helixAngle,
    steps: drill.steps.map((step) => ({ diameter: step.diameter, length: step.length })),
    sublandDiameter: drill.sublandDiameter,
    sublandLength: drill.sublandLength,
    chamferAngle: drill.chamferAngle,
    chamferDiameter: drill.chamferDiameter,
    countersinkAngle: drill.countersinkAngle,
    countersinkDiameter: drill.countersinkDiameter,
    pilotLength: drill.pilotLength,
    coolantHoles: drill.coolantHoles,
    stockMm: clampStockMm(stockMm),
  }
}

function mm(value: number): string {
  return String(Math.round(value * 100) / 100)
}

function usesFace(drill: DrillParams): boolean {
  if (drill.drillType === 'flat-bottom') return true
  return drill.drillType === 'core' && drill.pointAngle >= 170
}

function needsMakeGash(drill: DrillParams): boolean {
  return drill.webThinning !== 'none'
}

function needsResharpenGash(drill: DrillParams): boolean {
  if (drill.webThinning === 'none') return false
  switch (drill.drillType) {
    case 'spot90':
    case 'spot120':
    case 'gun':
    case 'center':
    case 'countersink':
    case 'flat-bottom':
    case 'core':
      return false
    case 'jobber':
    case 'stub':
    case 'taper':
    case 'step':
    case 'subland':
    case 'coolant':
    case 'parabolic':
    case 'straight':
    case 'micro':
    case 'double-margin':
      return true
    default: {
      const neverType: never = drill.drillType
      return neverType
    }
  }
}

function blankMaterial(drill: DrillParams): string {
  return drill.material === 'HSS' ? 'HSS rod' : 'carbide rod'
}

function fluteNarration(drill: DrillParams): string {
  if (drill.drillType === 'gun') {
    return drill.gunFluteStyle === 'v'
      ? 'A straight wheel cuts the V flute along the head. A gun drill is not helical.'
      : 'A straight wheel cuts the single straight flute along the head. A gun drill is not helical.'
  }
  if (drill.drillType === 'straight' || drill.helixAngle <= 5) {
    return 'The flutes are straight, so the wheel travels along the axis instead of winding around the tool.'
  }
  if (drill.drillType === 'parabolic') {
    return 'A flute wheel opens the wide parabolic grooves so chips have room to leave a deep hole.'
  }
  if (drill.drillType === 'double-margin') {
    return 'The flute wheel cuts the grooves and leaves two margins on each land. The second margin guides the drill in the hole.'
  }
  if (drill.drillType === 'spot90' || drill.drillType === 'spot120') {
    return 'A short flute is enough on a spot drill. The wheel only opens a little groove behind the point.'
  }
  return `A flute wheel cuts ${drill.fluteCount} grooves at about ${mm(drill.helixAngle)}°. Chips travel up those grooves.`
}

function blankOp(drill: DrillParams): OpDraft {
  const material = blankMaterial(drill)
  return {
    id: 'make-blank',
    title: 'Start from a rod blank',
    narration: `The grind starts from a ${material}, a little over the finished size. Nothing has been cut yet. This is a picture of the sequence, not a machine program.`,
    detail: `${material}, oversize`,
    forms: 'Blank',
    duty: 'inspect',
    stage: 'blank',
  }
}

function odOp(drill: DrillParams): OpDraft {
  const size =
    drill.drillType === 'step'
      ? Math.max(drill.diameter, ...drill.steps.map((step) => step.diameter))
      : drill.diameter
  return {
    id: 'make-od',
    title: 'Cylindrical grind',
    narration: `The rod is oversize. A straight wheel brings the outside down to ${mm(size)} mm. That sets the cutting diameter. No wheel speed or feed is shown.`,
    detail: `OD to ${mm(size)} mm`,
    forms: 'Cutting diameter',
    duty: 'od',
    stage: 'od',
  }
}

function fluteOp(drill: DrillParams): OpDraft {
  return {
    id: 'make-flute',
    title: 'Flute',
    narration: fluteNarration(drill),
    detail:
      drill.helixAngle <= 5 || drill.drillType === 'gun' || drill.drillType === 'straight'
        ? 'Straight flute'
        : `${drill.fluteCount} flutes · ${mm(drill.helixAngle)}°`,
    forms: 'Flutes',
    duty: 'flute',
    stage: 'flute',
  }
}

function clearanceOp(drill: DrillParams): OpDraft {
  return {
    id: 'make-clearance',
    title: 'Margin and body clearance',
    narration: `Behind a narrow margin, the body is cleared about ${mm(drill.bodyClearance)} mm on diameter, with back taper of ${mm(drill.backTaper)} mm per 100 mm. The margin is what rubs the hole. The rest of the body stays clear.`,
    detail: `Margin ${mm(drill.marginWidth)} mm · clearance ${mm(drill.bodyClearance)} mm`,
    forms: 'Margin and body clearance',
    duty: 'clearance',
    stage: 'clearance',
  }
}

function pointOp(drill: DrillParams): OpDraft {
  return {
    id: 'make-point',
    title: 'Point and primary relief',
    narration: `A cup wheel forms the ${mm(drill.pointAngle)}° point and the primary lip relief (${mm(drill.lipReliefAngle)}°). The two lips are what cut the bottom of the hole.`,
    detail: `${mm(drill.pointAngle)}° point · ${mm(drill.lipReliefAngle)}° primary`,
    forms: 'Point and primary relief',
    duty: 'point',
    stage: 'point',
  }
}

function secondaryOp(): OpDraft {
  return {
    id: 'make-secondary',
    title: 'Secondary relief',
    narration:
      'A second pass clears material behind the cutting lip so only a narrow land actually cuts. The point angle stays the same.',
    detail: 'Secondary lip relief',
    forms: 'Secondary relief',
    duty: 'point',
    stage: 'secondary',
  }
}

function gashOp(drill: DrillParams): OpDraft {
  const style = drill.webThinning === 'none' ? 'web' : drill.webThinning
  return {
    id: 'make-gash',
    title: 'Gash / web thinning',
    narration: `A flared wheel thins the web at the point (${style}). That shortens the chisel so the drill needs less push to start. In this demonstration the point is formed first, then the web is thinned.`,
    detail: `Web thinning · ${style}`,
    forms: 'Web / chisel',
    duty: 'gash',
    stage: 'gash',
  }
}

function coolantOp(drill: DrillParams): OpDraft {
  const count = drill.coolantHoles
  return {
    id: 'make-coolant',
    title: 'Coolant holes',
    narration:
      count === 1
        ? 'The coolant hole is already in the sintered blank or the tube. Confirm it is open. This simulator does not cut the hole.'
        : `The ${count} coolant holes are already in the sintered blank. Confirm they are open. This simulator does not cut them.`,
    detail: 'Confirm holes — not a grind',
    forms: 'Coolant holes',
    duty: 'blank-feature',
    stage: 'coolant',
  }
}

function stepOp(drill: DrillParams): OpDraft {
  const sizes = drill.steps.map((step) => `${mm(step.diameter)} mm`).join(', ')
  return {
    id: 'make-step',
    title: 'Step shoulders',
    narration: `A dish wheel forms each shoulder. This drill steps through ${sizes || `${mm(drill.diameter)} mm`}. The wheel follows the diameter change. It does not show a feed.`,
    detail: sizes || 'Shoulders',
    forms: 'Step shoulders',
    duty: 'chamfer',
    stage: 'step',
  }
}

function chamferOp(drill: DrillParams, kind: 'countersink' | 'center'): OpDraft {
  if (kind === 'center') {
    return {
      id: 'make-chamfer',
      title: 'Countersink',
      narration: `A dish wheel forms the ${mm(drill.countersinkAngle)}° countersink behind the pilot. That cone is what seats in the center hole.`,
      detail: `${mm(drill.countersinkAngle)}° countersink`,
      forms: 'Countersink',
      duty: 'chamfer',
      stage: 'chamfer',
    }
  }
  return {
    id: 'make-chamfer',
    title: 'Chamfer',
    narration: `A dish wheel forms the ${mm(drill.chamferAngle)}° chamfer out to ${mm(drill.chamferDiameter)} mm, behind the drill point.`,
    detail: `${mm(drill.chamferAngle)}° chamfer`,
    forms: 'Chamfer',
    duty: 'chamfer',
    stage: 'chamfer',
  }
}

function faceOp(drill: DrillParams): OpDraft {
  return {
    id: 'make-face',
    title: 'Flat face',
    narration:
      drill.drillType === 'core'
        ? 'A cup wheel faces the end flat. A core drill opens an existing hole, so it does not come to a sharp point.'
        : 'A cup wheel faces the end flat, with only a small center left so the drill does not walk. There is no sharp point.',
    detail: 'Flat face',
    forms: 'End face',
    duty: 'point',
    stage: 'face',
  }
}

function driverOp(): OpDraft {
  return {
    id: 'make-driver',
    title: 'Driver flat',
    narration:
      'A straight wheel grinds a driver flat on the shank so the gun drill can be held. The flat shown here is generic, not a particular holder.',
    detail: 'Driver flat',
    forms: 'Driver',
    duty: 'od',
    stage: 'driver',
  }
}

function applyStage(show: readonly GrindStage[], stage: GrindStage): GrindStage[] {
  if (stage === 'length') {
    const removed = new Set<GrindStage>(['wear', 'point', 'secondary', 'gash', 'face', 'length'])
    return [...show.filter((item) => !removed.has(item)), 'length']
  }
  if (show.includes(stage)) return [...show]
  return [...show, stage]
}

function compile(initial: GrindStage[], drafts: OpDraft[]): GrindOp[] {
  let show = initial
  return drafts.map((draft) => {
    show = applyStage(show, draft.stage)
    return { ...draft, show }
  })
}

function pushClearance(drill: DrillParams, drafts: OpDraft[]) {
  if (drill.drillType !== 'center') drafts.push(clearanceOp(drill))
}

function pushPointOrFace(drill: DrillParams, drafts: OpDraft[]) {
  if (usesFace(drill)) {
    drafts.push(faceOp(drill))
    return
  }
  drafts.push(pointOp(drill))
  drafts.push(secondaryOp())
}

function pushGash(drill: DrillParams, drafts: OpDraft[]) {
  if (needsMakeGash(drill)) drafts.push(gashOp(drill))
}

function pushCoolant(drill: DrillParams, drafts: OpDraft[]) {
  if (drill.coolantHoles > 0) drafts.push(coolantOp(drill))
}

function twistMake(drill: DrillParams): OpDraft[] {
  const drafts: OpDraft[] = [blankOp(drill), odOp(drill), fluteOp(drill)]
  pushClearance(drill, drafts)
  pushPointOrFace(drill, drafts)
  pushGash(drill, drafts)
  pushCoolant(drill, drafts)
  return drafts
}

function stepMake(drill: DrillParams): OpDraft[] {
  const drafts: OpDraft[] = [blankOp(drill), odOp(drill), stepOp(drill), fluteOp(drill)]
  pushClearance(drill, drafts)
  pushPointOrFace(drill, drafts)
  pushGash(drill, drafts)
  pushCoolant(drill, drafts)
  return drafts
}

function sublandMake(drill: DrillParams): OpDraft[] {
  const drafts: OpDraft[] = [
    blankOp(drill),
    {
      ...odOp(drill),
      narration: `A straight wheel sets the front diameter at ${mm(drill.diameter)} mm and the rear land at ${mm(drill.sublandDiameter)} mm.`,
      forms: 'Front and rear diameters',
    },
    {
      ...stepOp(drill),
      title: 'Rear land shoulder',
      narration: `A dish wheel forms the shoulder where the ${mm(drill.diameter)} mm front land steps up to the ${mm(drill.sublandDiameter)} mm rear land.`,
      detail: `${mm(drill.diameter)} → ${mm(drill.sublandDiameter)} mm`,
      forms: 'Subland shoulder',
    },
    fluteOp(drill),
  ]
  pushClearance(drill, drafts)
  pushPointOrFace(drill, drafts)
  pushGash(drill, drafts)
  return drafts
}

function centerMake(drill: DrillParams): OpDraft[] {
  return [
    blankOp(drill),
    {
      ...odOp(drill),
      narration: `A straight wheel sets the body. The pilot is ${mm(drill.diameter)} mm and the countersink opens to ${mm(drill.countersinkDiameter)} mm.`,
      forms: 'Body diameter',
    },
    {
      ...fluteOp(drill),
      narration: 'Short flutes are cut on the pilot and into the countersink so the lips can cut.',
    },
    {
      ...pointOp(drill),
      narration: `A cup wheel forms the small pilot point (${mm(drill.pointAngle)}°). The pilot starts the center hole.`,
      forms: 'Pilot point',
    },
    secondaryOp(),
    chamferOp(drill, 'center'),
  ]
}

function countersinkMake(drill: DrillParams): OpDraft[] {
  const drafts: OpDraft[] = [blankOp(drill), odOp(drill), fluteOp(drill)]
  pushClearance(drill, drafts)
  pushPointOrFace(drill, drafts)
  drafts.push(chamferOp(drill, 'countersink'))
  return drafts
}

function gunMake(drill: DrillParams): OpDraft[] {
  const drafts: OpDraft[] = [
    {
      ...blankOp(drill),
      narration:
        'A gun drill starts from a headed blank or a tube, not from a twist-drill flute. The picture shows a plain rod before the head is formed.',
      forms: 'Gun-drill blank',
    },
    {
      ...odOp(drill),
      narration: `A straight wheel brings the head to ${mm(drill.diameter)} mm.`,
      forms: 'Head diameter',
    },
    fluteOp(drill),
  ]
  pushClearance(drill, drafts)
  drafts.push({
    ...pointOp(drill),
    narration: `A cup wheel forms the ${mm(drill.pointAngle)}° point and the primary relief on the single lip.`,
    forms: 'Head point and relief',
  })
  drafts.push(secondaryOp())
  pushCoolant(drill, drafts)
  drafts.push(driverOp())
  return drafts
}

function makeDrafts(drill: DrillParams): OpDraft[] {
  switch (drill.drillType) {
    case 'jobber':
    case 'stub':
    case 'taper':
    case 'spot90':
    case 'spot120':
    case 'coolant':
    case 'parabolic':
    case 'straight':
    case 'micro':
    case 'double-margin':
    case 'flat-bottom':
    case 'core':
      return twistMake(drill)
    case 'step':
      return stepMake(drill)
    case 'subland':
      return sublandMake(drill)
    case 'center':
      return centerMake(drill)
    case 'countersink':
      return countersinkMake(drill)
    case 'gun':
      return gunMake(drill)
    default: {
      const neverType: never = drill.drillType
      return neverType
    }
  }
}

function finishedShow(drill: DrillParams): GrindStage[] {
  const show: GrindStage[] = ['blank', 'od', 'flute']
  if (drill.drillType !== 'center') show.push('clearance')
  if (needsMakeGash(drill)) show.push('gash')
  if (usesFace(drill)) show.push('face')
  else show.push('point', 'secondary')
  if (drill.drillType === 'step' || drill.drillType === 'subland') show.push('step')
  if (drill.drillType === 'countersink' || drill.drillType === 'center') show.push('chamfer')
  if (drill.coolantHoles > 0) show.push('coolant')
  if (drill.drillType === 'gun') show.push('driver')
  show.push('wear')
  return show
}

function wearOp(): OpDraft {
  return {
    id: 'resharpen-wear',
    title: 'Worn cutting end',
    narration:
      'The lips are rounded and the point is rubbed. That wear is why the drill is back on the machine. The picture exaggerates the dull tip so it is easy to see.',
    detail: 'Wear on the lips',
    forms: 'Worn point',
    duty: 'inspect',
    stage: 'wear',
  }
}

function lengthOp(drill: DrillParams, stock: number): OpDraft {
  return {
    id: 'resharpen-length',
    title: 'Remove worn length',
    narration: `Take ${mm(stock)} mm off the tip of this ${mm(drill.diameter)} mm drill so the worn lips are gone. The amount is a setup choice for the demonstration, not a feed rate.`,
    detail: `Remove ${mm(stock)} mm`,
    forms: 'Shortened tip',
    duty: 'point',
    stage: 'length',
  }
}

function resharpenPoint(drill: DrillParams): OpDraft {
  return {
    ...pointOp(drill),
    id: 'resharpen-point',
    narration: `Grind the ${mm(drill.pointAngle)}° point and the primary relief back onto the fresh face. Only the worn end is reground. The flutes stay as they are.`,
  }
}

function resharpenSecondary(): OpDraft {
  return {
    ...secondaryOp(),
    id: 'resharpen-secondary',
    narration: 'Clear the secondary relief behind the new lip. The flutes are not recut.',
  }
}

function resharpenGash(drill: DrillParams): OpDraft {
  return {
    ...gashOp(drill),
    id: 'resharpen-gash',
    narration:
      'Thin the web again on the new point. The old thinning was ground away with the worn tip. Flutes are left alone.',
  }
}

function resharpenFace(drill: DrillParams): OpDraft {
  return {
    ...faceOp(drill),
    id: 'resharpen-face',
    narration: 'Face the end flat again after the worn length is gone. The flutes are not recut.',
  }
}

function resharpenDrafts(drill: DrillParams, stock: number): OpDraft[] {
  const drafts: OpDraft[] = [wearOp(), lengthOp(drill, stock)]
  if (usesFace(drill)) {
    drafts.push(resharpenFace(drill))
    return drafts
  }
  drafts.push(resharpenPoint(drill), resharpenSecondary())
  if (needsResharpenGash(drill)) drafts.push(resharpenGash(drill))
  return drafts
}

export function grindOps(drill: DrillParams, mode: GrindMode, stockMm: number): GrindSequence {
  const stock = clampStockMm(stockMm)
  if (mode === 'resharpen') {
    const initialShow = finishedShow(drill)
    return {
      mode,
      stockRemovedMm: stock,
      initialShow,
      operations: compile(initialShow, resharpenDrafts(drill, stock)),
    }
  }
  if (mode === 'make') {
    return {
      mode,
      stockRemovedMm: stock,
      initialShow: [],
      operations: compile([], makeDrafts(drill)),
    }
  }
  const neverMode: never = mode
  return neverMode
}
