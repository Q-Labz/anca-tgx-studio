import { pointConeHeight, frustumHeight, roundMm, formatMm } from './drillMath'
import {
  CENTER_DRILL_SPECS,
  applyCenterDrillSize,
  createDrill,
  getDrillType,
  type DrillFieldKey,
} from './drillTypes'
import type { DrillParams, DrillTypeId, WebThinningStyle } from './types'
import { DRILL_TYPE_IDS } from './types'
import { validateDrill } from './validation'

/** Persisted designer choice. Beginner is the default for a first visit. */
export const EXPERIENCE_STORAGE_KEY = 'anca-tgx-studio:experience'

export type ExperienceMode = 'beginner' | 'expert'

export type WorkpieceMaterial =
  | 'aluminum'
  | 'mild-steel'
  | 'stainless'
  | 'cast-iron'
  | 'brass'
  | 'plastic'
  | 'hardened'
  | 'unsure'

export type HoleFeature = 'plain' | 'flat' | 'chamfer' | 'steps' | 'center'

export type CoolantAnswer = 'yes' | 'no' | 'unsure'

/** Preview region a field can light up. */
export type PreviewPart = 'point' | 'flute' | 'shank' | 'coolant' | 'step' | 'chamfer' | 'web' | 'margin'

export type DiagramKind =
  | 'none'
  | 'diameter'
  | 'point'
  | 'flute'
  | 'shank'
  | 'web'
  | 'helix'
  | 'margin'
  | 'coolant'
  | 'step'
  | 'chamfer'

export interface WizardAnswers {
  material: WorkpieceMaterial
  diameter: number
  depth: number
  feature: HoleFeature
  throughCoolant: CoolantAnswer
}

export interface DrillRecommendation {
  ok: boolean
  drill: DrillParams | null
  reason: string
  notes: string[]
}

export interface DrillAlternative {
  drill: DrillParams
  reason: string
}

export interface DrillCardCopy {
  forWhat: string
  useWhen: string
  avoidWhen: string
}

export interface FieldHelpEntry {
  text: string
  diagram: DiagramKind
  part: PreviewPart | null
}

export interface DrillAdvisory {
  id: string
  message: string
  adopt?: DrillTypeId
}

export interface StarterTemplate {
  id: string
  title: string
  blurb: string
  workpiece: WorkpieceMaterial
  drill: DrillParams
}

export const WORKPIECE_OPTIONS: { id: WorkpieceMaterial; label: string }[] = [
  { id: 'aluminum', label: 'Aluminum' },
  { id: 'mild-steel', label: 'Mild steel' },
  { id: 'stainless', label: 'Stainless steel' },
  { id: 'cast-iron', label: 'Cast iron' },
  { id: 'brass', label: 'Brass or bronze' },
  { id: 'plastic', label: 'Plastic' },
  { id: 'hardened', label: 'Hardened steel' },
  { id: 'unsure', label: 'Not sure' },
]

export const FEATURE_OPTIONS: { id: HoleFeature; label: string; hint: string }[] = [
  { id: 'plain', label: 'Just a round hole', hint: 'One diameter, pointed bottom is fine' },
  { id: 'flat', label: 'Flat bottom', hint: 'The print wants a flat floor' },
  { id: 'chamfer', label: 'Hole plus a chamfer', hint: 'Break the edge in the same tool' },
  { id: 'steps', label: 'More than one diameter', hint: 'A step, like a small hole then a larger one' },
  { id: 'center', label: 'A lathe center hole', hint: 'Combined drill and countersink, not a production hole' },
]

export const COOLANT_OPTIONS: { id: CoolantAnswer; label: string }[] = [
  { id: 'yes', label: 'Yes — coolant can go through the tool' },
  { id: 'no', label: 'No' },
  { id: 'unsure', label: 'Not sure' },
]

const BEGINNER_FIELDS: Record<DrillTypeId, readonly DrillFieldKey[]> = {
  jobber: ['name', 'diameter', 'pointAngle', 'fluteLength', 'overallLength', 'shankDiameter'],
  stub: ['name', 'diameter', 'pointAngle', 'fluteLength', 'overallLength', 'shankDiameter'],
  taper: ['name', 'diameter', 'pointAngle', 'fluteLength', 'overallLength', 'shankDiameter'],
  straight: ['name', 'diameter', 'pointAngle', 'fluteLength', 'overallLength', 'shankDiameter'],
  parabolic: ['name', 'diameter', 'pointAngle', 'fluteLength', 'overallLength', 'shankDiameter'],
  coolant: ['name', 'diameter', 'pointAngle', 'fluteLength', 'overallLength', 'coolantHoles'],
  'double-margin': ['name', 'diameter', 'pointAngle', 'fluteLength', 'overallLength', 'shankDiameter'],
  micro: ['name', 'diameter', 'pointAngle', 'fluteLength', 'overallLength', 'shankDiameter'],
  spot90: ['name', 'diameter', 'pointAngle', 'fluteLength', 'overallLength', 'shankDiameter'],
  spot120: ['name', 'diameter', 'pointAngle', 'fluteLength', 'overallLength', 'shankDiameter'],
  center: ['name', 'centerSize', 'diameter', 'countersinkDiameter', 'countersinkAngle', 'overallLength'],
  step: ['name', 'steps', 'pointAngle', 'overallLength', 'shankDiameter'],
  subland: ['name', 'diameter', 'fluteLength', 'sublandDiameter', 'sublandLength', 'pointAngle'],
  gun: ['name', 'diameter', 'pointAngle', 'fluteLength', 'overallLength', 'gunFluteStyle'],
  countersink: ['name', 'diameter', 'pointAngle', 'fluteLength', 'chamferAngle', 'chamferDiameter'],
  'flat-bottom': ['name', 'diameter', 'pointAngle', 'fluteLength', 'overallLength', 'shankDiameter'],
  core: ['name', 'diameter', 'fluteCount', 'fluteLength', 'overallLength', 'shankDiameter'],
}

const FIELD_HELP: Record<DrillFieldKey, FieldHelpEntry> = {
  name: {
    text: 'A shop name for this tool. It shows on the traveler and the handoff sheet.',
    diagram: 'none',
    part: null,
  },
  diameter: {
    text: 'The size of the hole the cutting lips will make, in millimetres.',
    diagram: 'diameter',
    part: 'flute',
  },
  pointAngle: {
    text: 'How sharp the tip is, measured as the included angle. 118° is the general-purpose point.',
    diagram: 'point',
    part: 'point',
  },
  fluteCount: {
    text: 'How many grooves carry chips. Most drills have two.',
    diagram: 'flute',
    part: 'flute',
  },
  helixAngle: {
    text: 'How much the flutes twist. Zero is a straight flute, which is safer in brass.',
    diagram: 'helix',
    part: 'flute',
  },
  overallLength: {
    text: 'The whole tool from the tip to the end of the shank.',
    diagram: 'shank',
    part: 'shank',
  },
  fluteLength: {
    text: 'How far the cutting flutes reach back from the tip. This has to cover the hole depth.',
    diagram: 'flute',
    part: 'flute',
  },
  shankDiameter: {
    text: 'The diameter the holder grips. It is often the same as the drill, or larger on a micro drill.',
    diagram: 'shank',
    part: 'shank',
  },
  shankLength: {
    text: 'How much plain shank sits in the holder, behind the flutes.',
    diagram: 'shank',
    part: 'shank',
  },
  webThickness: {
    text: 'The thickness of the core between the flutes. A thicker web is stronger and needs thinning.',
    diagram: 'web',
    part: 'web',
  },
  webThinning: {
    text: 'A grind on the web so the chisel can cut. Split, S, and X are common styles.',
    diagram: 'web',
    part: 'web',
  },
  webThinningNote: {
    text: 'Optional note for the grinder about the web thinning. It does not change the picture.',
    diagram: 'web',
    part: 'web',
  },
  marginWidth: {
    text: 'The narrow land that rubs the hole and keeps the drill straight.',
    diagram: 'margin',
    part: 'margin',
  },
  bodyClearance: {
    text: 'How much smaller the body is behind the margin, so only the land touches the hole.',
    diagram: 'margin',
    part: 'flute',
  },
  lipReliefAngle: {
    text: 'Clearance ground behind the cutting lip so the heel does not rub.',
    diagram: 'point',
    part: 'point',
  },
  backTaper: {
    text: 'A slight diameter drop along the flute so the body does not bind deeper in the hole.',
    diagram: 'flute',
    part: 'flute',
  },
  coolantHoles: {
    text: 'Passages that let the machine push coolant out at the tip. Only useful if the holder can feed it.',
    diagram: 'coolant',
    part: 'coolant',
  },
  coolantHoleDiameter: {
    text: 'The size of each coolant passage. It has to fit inside the web.',
    diagram: 'coolant',
    part: 'coolant',
  },
  steps: {
    text: 'Each step is a larger diameter behind the one in front. Step 1 is the tip.',
    diagram: 'step',
    part: 'step',
  },
  sublandDiameter: {
    text: 'The second cutting diameter, behind the front land. It is larger than the tip.',
    diagram: 'step',
    part: 'step',
  },
  sublandLength: {
    text: 'How long the larger rear land cuts.',
    diagram: 'step',
    part: 'step',
  },
  centerSize: {
    text: 'ANSI combined drill and countersink size. The millimetre values are the inch size converted.',
    diagram: 'chamfer',
    part: 'point',
  },
  countersinkAngle: {
    text: 'Included angle of the countersink behind the pilot. 60° is the usual lathe center.',
    diagram: 'chamfer',
    part: 'chamfer',
  },
  countersinkDiameter: {
    text: 'How wide the countersink opens, larger than the pilot.',
    diagram: 'chamfer',
    part: 'chamfer',
  },
  pilotLength: {
    text: 'Length of the small drill in front of the countersink.',
    diagram: 'point',
    part: 'point',
  },
  chamferAngle: {
    text: 'Included angle of the chamfer behind the drill point.',
    diagram: 'chamfer',
    part: 'chamfer',
  },
  chamferDiameter: {
    text: 'How wide the chamfer reaches. It must be larger than the hole.',
    diagram: 'chamfer',
    part: 'chamfer',
  },
  gunFluteStyle: {
    text: 'Single-lip is the classic gun drill. V-flute is the two-flute variant.',
    diagram: 'flute',
    part: 'flute',
  },
  coating: {
    text: 'A surface coating such as TiN or AlTiN. Leave a note if the blank is uncoated.',
    diagram: 'none',
    part: null,
  },
  material: {
    text: 'What the tool is made of. Carbide is the usual choice here; pick HSS if that is the blank you have.',
    diagram: 'none',
    part: null,
  },
}

const CARD_COPY: Record<DrillTypeId, DrillCardCopy> = {
  jobber: {
    forWhat: 'Everyday twist drill for ordinary holes.',
    useWhen: 'The hole is a few diameters deep and the material is not grabbing.',
    avoidWhen: 'Very deep holes, or brass that will pull a twisted flute in.',
  },
  stub: {
    forWhat: 'Short, stiff screw-machine drill.',
    useWhen: 'The hole is shallow and you want less wander.',
    avoidWhen: 'Anything deep — the flute runs out.',
  },
  taper: {
    forWhat: 'Longer twist drill between a jobber and a gun drill.',
    useWhen: 'The hole is deeper than a jobber but still a twist-drill job.',
    avoidWhen: 'Extreme depth that needs a bushing and through-coolant.',
  },
  spot90: {
    forWhat: 'Short 90° spot that starts a hole or leaves a small chamfer.',
    useWhen: 'You only need to nick the surface or lead a 90° edge.',
    avoidWhen: 'Drilling to any real depth.',
  },
  spot120: {
    forWhat: 'Short 120° spot that starts a hole on location.',
    useWhen: 'You will follow it with a twist drill and want the point to seat.',
    avoidWhen: 'Drilling the finished depth with this tool.',
  },
  center: {
    forWhat: 'Combined drill and countersink for a lathe center.',
    useWhen: 'The print calls for a center hole, sizes #00 through #8.',
    avoidWhen: 'A production hole. This is a center, not a jobber.',
  },
  step: {
    forWhat: 'One tool that cuts two or more diameters.',
    useWhen: 'A short hole in sheet or a shallow stepped hole.',
    avoidWhen: 'Deep holes — chips pack at the steps.',
  },
  subland: {
    forWhat: 'Two diameters, each with its own land and point.',
    useWhen: 'Both diameters must cut, not just step up.',
    avoidWhen: 'A simple step is enough. A subland is harder to grind and run.',
  },
  coolant: {
    forWhat: 'Carbide drill that pushes coolant out at the point.',
    useWhen: 'Deeper holes in steel or stainless, and the machine can feed coolant through the holder.',
    avoidWhen: 'The machine has no through-spindle coolant. Use a parabolic flute instead.',
  },
  parabolic: {
    forWhat: 'Wide flute that helps chips climb out of a deeper hole.',
    useWhen: 'The hole is deep and you cannot push coolant through the tool.',
    avoidWhen: 'Extreme depth. That is a gun drill with a bushing.',
  },
  gun: {
    forWhat: 'Single-lip deep-hole drill with a coolant hole down the tube.',
    useWhen: 'A deep hole, a guide bushing, and coolant are all available.',
    avoidWhen: 'Ordinary holes. It is not a twist drill and it will not start itself in open air.',
  },
  straight: {
    forWhat: 'Flutes with almost no twist, so the drill does not grab.',
    useWhen: 'Brass, bronze, and other materials that pull a helix in.',
    avoidWhen: 'Steel, as a first choice. A twisted flute clears those chips better.',
  },
  micro: {
    forWhat: 'A drill under about 3 mm, usually on a thicker shank.',
    useWhen: 'The hole itself is tiny and the holder wants a normal shank.',
    avoidWhen: 'Holes above 3 mm — use a jobber or stub.',
  },
  countersink: {
    forWhat: 'A drill point and a chamfer on the same tool.',
    useWhen: 'The hole is shallow and the edge needs a chamfer in one pass.',
    avoidWhen: 'A deep hole, or a lathe center (use a center drill).',
  },
  'flat-bottom': {
    forWhat: 'A flat floor, with a small center point so the drill still tracks.',
    useWhen: 'The print asks for a flat bottom.',
    avoidWhen: 'A normal pointed hole. A 118° jobber is simpler.',
  },
  core: {
    forWhat: 'Opens a hole that already exists. It does not cut the center.',
    useWhen: 'You are enlarging a pre-drilled or cored hole.',
    avoidWhen: 'Starting a hole in solid material.',
  },
  'double-margin': {
    forWhat: 'A second land that steadies the drill in the hole.',
    useWhen: 'A production hole that has to stay straight.',
    avoidWhen: 'A one-off simple hole. A jobber is enough.',
  },
}

const SHORT_FLUTE_TYPES: ReadonlySet<DrillTypeId> = new Set([
  'jobber',
  'stub',
  'straight',
  'micro',
  'spot90',
  'spot120',
  'countersink',
])

export function readExperienceMode(): ExperienceMode {
  try {
    if (typeof localStorage === 'undefined') return 'beginner'
    return localStorage.getItem(EXPERIENCE_STORAGE_KEY) === 'expert' ? 'expert' : 'beginner'
  } catch {
    return 'beginner'
  }
}

export function writeExperienceMode(mode: ExperienceMode): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(EXPERIENCE_STORAGE_KEY, mode)
  } catch {
    // Private browsing can refuse storage. The toggle still works for this visit.
  }
}

export function beginnerFieldKeys(typeId: DrillTypeId): readonly DrillFieldKey[] {
  return BEGINNER_FIELDS[typeId]
}

export function fieldHelp(key: DrillFieldKey): FieldHelpEntry {
  return FIELD_HELP[key]
}

export function drillCard(typeId: DrillTypeId): DrillCardCopy {
  return CARD_COPY[typeId]
}

export function workpieceLabel(material: WorkpieceMaterial): string {
  const match = WORKPIECE_OPTIONS.find((option) => option.id === material)
  return match ? match.label : material
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function valid(drill: DrillParams): boolean {
  return Object.keys(validateDrill(drill)).length === 0
}

function pointFor(material: WorkpieceMaterial, typeId: DrillTypeId): number {
  if (typeId === 'flat-bottom') return 180
  if (typeId === 'spot90') return 90
  if (typeId === 'spot120') return 120
  if (typeId === 'center') return 118
  if (typeId === 'gun') return 130
  if (typeId === 'coolant') return 140
  switch (material) {
    case 'aluminum':
      return 130
    case 'mild-steel':
      return 135
    case 'stainless':
    case 'hardened':
      return 140
    case 'cast-iron':
    case 'brass':
    case 'plastic':
    case 'unsure':
      return 118
    default: {
      const exhaustive: never = material
      return exhaustive
    }
  }
}

function webFraction(typeId: DrillTypeId): number {
  if (typeId === 'parabolic') return 0.32
  if (typeId === 'coolant') return 0.25
  return 0.18
}

function thinningFor(typeId: DrillTypeId): WebThinningStyle {
  switch (typeId) {
    case 'coolant':
      return 'X'
    case 'parabolic':
      return 'S'
    case 'straight':
    case 'spot90':
    case 'spot120':
    case 'flat-bottom':
    case 'gun':
    case 'center':
    case 'core':
      return 'none'
    case 'jobber':
    case 'stub':
    case 'taper':
    case 'step':
    case 'subland':
    case 'micro':
    case 'countersink':
    case 'double-margin':
      return 'split'
    default: {
      const exhaustive: never = typeId
      return exhaustive
    }
  }
}

interface FitResult {
  flute: number
  shank: number
  oal: number
  clipped: boolean
}

function fitLengths(typeId: DrillTypeId, fluteWant: number, shankWant: number): FitResult {
  const limits = getDrillType(typeId).limits
  let clipped = false
  let flute = clamp(fluteWant, limits.fluteLength.min, limits.fluteLength.max)
  if (Math.abs(flute - fluteWant) > 0.05) clipped = true
  let shank = clamp(shankWant, limits.shankLength.min, limits.shankLength.max)
  let oal = clamp(roundMm(flute + shank + 2), limits.overallLength.min, limits.overallLength.max)
  if (flute + shank > oal - 0.3) {
    const shankRoom = oal - flute - 1
    if (shankRoom >= limits.shankLength.min) {
      shank = roundMm(Math.min(shankRoom, limits.shankLength.max))
    } else {
      shank = limits.shankLength.min
      const fluteRoom = oal - shank - 1
      const nextFlute = clamp(fluteRoom, limits.fluteLength.min, limits.fluteLength.max)
      if (nextFlute < flute - 0.05) clipped = true
      flute = roundMm(nextFlute)
    }
  }
  if (flute >= oal) {
    flute = roundMm(Math.max(limits.fluteLength.min, oal - shank - 1))
    clipped = true
  }
  return { flute: roundMm(flute), shank: roundMm(shank), oal: roundMm(oal), clipped }
}

function proportionals(typeId: DrillTypeId, diameter: number, base: DrillParams) {
  const places = diameter < 2 ? 3 : 2
  const web = roundMm(clamp(diameter * webFraction(typeId), diameter * 0.08, diameter * 0.4), places)
  const margin = roundMm(clamp(diameter * 0.08, 0, diameter * 0.18), places)
  const body = roundMm(Math.min(diameter * 0.02, 0.08), places)
  let coolantHoles = 0
  let coolantHoleDiameter = base.coolantHoleDiameter
  if (typeId === 'coolant') {
    coolantHoles = 2
    coolantHoleDiameter = roundMm(clamp(web * 0.35, 0.08, diameter * 0.12), places)
  } else if (typeId === 'gun') {
    coolantHoles = 1
    coolantHoleDiameter = roundMm(clamp(diameter * 0.18, 0.1, diameter * 0.4), places)
  }
  let shankDiameter = roundMm(clamp(diameter, getDrillType(typeId).limits.shankDiameter.min, getDrillType(typeId).limits.shankDiameter.max))
  if (typeId === 'micro') {
    shankDiameter = roundMm(
      clamp(Math.max(diameter, 3), getDrillType(typeId).limits.shankDiameter.min, getDrillType(typeId).limits.shankDiameter.max),
    )
  }
  return { web, margin, body, coolantHoles, coolantHoleDiameter, shankDiameter }
}

function helixFor(typeId: DrillTypeId, base: DrillParams): number {
  if (typeId === 'straight' || typeId === 'gun') return 0
  if (typeId === 'parabolic') return 37
  return base.helixAngle
}

function sizedName(typeId: DrillTypeId, diameter: number, point: number): string {
  const prefix: Record<DrillTypeId, string> = {
    jobber: 'DR',
    stub: 'STUB',
    taper: 'LONG',
    spot90: 'SPOT',
    spot120: 'SPOT',
    center: 'CD',
    step: 'STEP',
    subland: 'SUB',
    coolant: 'CT',
    parabolic: 'PAR',
    gun: 'GUN',
    straight: 'SF',
    micro: 'MICRO',
    countersink: 'CSK',
    'flat-bottom': 'FB',
    core: 'CORE',
    'double-margin': 'DM',
  }
  return `${prefix[typeId]}-${formatMm(diameter)}-${Math.round(point)}`
}

/** Build a conservative, valid drill of this family for a hole size. */
export function sizeDrill(
  typeId: DrillTypeId,
  diameter: number,
  depth: number,
  material: WorkpieceMaterial,
): { drill: DrillParams; clipped: boolean } | null {
  if (typeId === 'center') {
    const drill = centerForDiameter(diameter)
    return drill ? { drill, clipped: false } : null
  }
  if (!typeFits(typeId, diameter)) return null
  const base = createDrill(typeId)
  const point = clamp(
    pointFor(material, typeId),
    getDrillType(typeId).limits.pointAngle.min,
    getDrillType(typeId).limits.pointAngle.max,
  )
  const parts = proportionals(typeId, diameter, base)
  const cone = pointConeHeight(diameter, point)

  if (typeId === 'step') {
    const drill = buildStep(diameter, depth, point, parts, base)
    return drill && valid(drill) ? { drill, clipped: false } : null
  }

  if (typeId === 'countersink') {
    const drill = buildCountersink(diameter, depth, point, parts, base)
    return drill && valid(drill) ? { drill, clipped: false } : null
  }

  const spot = typeId === 'spot90' || typeId === 'spot120'
  const fluteWant = spot
    ? Math.max(cone + 3, Math.min(diameter * 0.9, 16))
    : Math.max(depth + 1.5, cone + 1.2)
  const shankWant = typeId === 'micro' ? 28 : clamp(Math.max(diameter * 4, 25), 20, 80)
  const fit = fitLengths(typeId, fluteWant, shankWant)
  const drill: DrillParams = {
    ...base,
    name: sizedName(typeId, diameter, point),
    diameter: roundMm(diameter, diameter < 2 ? 3 : 2),
    pointAngle: point,
    helixAngle: helixFor(typeId, base),
    fluteLength: fit.flute,
    shankLength: fit.shank,
    overallLength: fit.oal,
    shankDiameter: parts.shankDiameter,
    webThickness: parts.web,
    webThinning: thinningFor(typeId),
    marginWidth: parts.margin,
    bodyClearance: parts.body,
    backTaper: Math.min(base.backTaper, 0.03),
    coolantHoles: parts.coolantHoles,
    coolantHoleDiameter: parts.coolantHoleDiameter,
    material: 'carbide',
    gunFluteStyle: typeId === 'gun' ? 'single' : base.gunFluteStyle,
    fluteCount: typeId === 'gun' ? 1 : base.fluteCount,
  }
  if (typeId === 'flat-bottom') drill.pointAngle = 180
  if (!valid(drill)) return null
  return { drill, clipped: fit.clipped }
}

function typeFits(typeId: DrillTypeId, diameter: number): boolean {
  const limits = getDrillType(typeId).limits.diameter
  return diameter >= limits.min && diameter <= limits.max
}

function centerForDiameter(diameter: number): DrillParams | null {
  let best: (typeof CENTER_DRILL_SPECS)[number] = CENTER_DRILL_SPECS[0]
  let bestDiff = Infinity
  for (const spec of CENTER_DRILL_SPECS) {
    const diff = Math.abs(spec.pilot - diameter)
    if (diff < bestDiff) {
      best = spec
      bestDiff = diff
    }
  }
  const drill = applyCenterDrillSize(createDrill('center'), best.size)
  return valid(drill) ? drill : null
}

function buildStep(
  diameter: number,
  depth: number,
  point: number,
  parts: ReturnType<typeof proportionals>,
  base: DrillParams,
): DrillParams | null {
  const limits = getDrillType('step').limits
  const second = roundMm(clamp(Math.max(diameter + 2, diameter * 1.5), diameter + 0.5, 40))
  if (!(second > diameter)) return null
  const len1 = roundMm(clamp(Math.max(depth, pointConeHeight(diameter, point) + 1.5, 4), 2, 40))
  const len2 = roundMm(clamp(Math.max(4, Math.min(depth * 0.6, 10)), 3, 20))
  const sum = roundMm(len1 + len2)
  const shank = roundMm(clamp(32, limits.shankLength.min, limits.shankLength.max))
  let oal = roundMm(sum + shank + 4)
  oal = clamp(oal, limits.overallLength.min, limits.overallLength.max)
  if (sum + shank > oal) return null
  const shankDia = roundMm(clamp(second, limits.shankDiameter.min, limits.shankDiameter.max))
  return {
    ...base,
    name: `STEP-${formatMm(diameter)}-${formatMm(second)}`,
    diameter: roundMm(diameter),
    pointAngle: point,
    steps: [
      { diameter: roundMm(diameter), length: len1 },
      { diameter: second, length: len2 },
    ],
    fluteLength: sum,
    overallLength: oal,
    shankDiameter: shankDia,
    shankLength: shank,
    webThickness: parts.web,
    webThinning: 'split',
    marginWidth: parts.margin,
    bodyClearance: parts.body,
    backTaper: 0.02,
    material: 'carbide',
  }
}

function buildCountersink(
  diameter: number,
  depth: number,
  point: number,
  parts: ReturnType<typeof proportionals>,
  base: DrillParams,
): DrillParams | null {
  const limits = getDrillType('countersink').limits
  const chamferDiameter = roundMm(clamp(Math.max(diameter * 1.6, diameter + 1), diameter + 0.4, 40))
  const chamferAngle = 90
  const cone = pointConeHeight(diameter, point)
  const axial = frustumHeight(diameter, chamferDiameter, chamferAngle)
  let flute = roundMm(clamp(Math.max(depth, cone + 0.8), limits.fluteLength.min, limits.fluteLength.max))
  let shank = roundMm(clamp(Math.max(28, diameter * 3), limits.shankLength.min, limits.shankLength.max))
  let oal = roundMm(flute + axial + shank + 1)
  oal = clamp(oal, limits.overallLength.min, limits.overallLength.max)
  if (flute + axial + shank > oal) {
    const room = oal - axial - flute - 1
    if (room >= limits.shankLength.min) shank = roundMm(room)
    else return null
  }
  return {
    ...base,
    name: sizedName('countersink', diameter, point),
    diameter: roundMm(diameter),
    pointAngle: point,
    fluteLength: flute,
    chamferAngle,
    chamferDiameter,
    overallLength: oal,
    shankLength: shank,
    shankDiameter: parts.shankDiameter,
    webThickness: parts.web,
    webThinning: 'split',
    marginWidth: parts.margin,
    material: 'carbide',
  }
}

function tough(material: WorkpieceMaterial): boolean {
  return material === 'mild-steel' || material === 'stainless' || material === 'hardened'
}

function chooseType(answers: WizardAnswers): DrillTypeId | null {
  const { feature, material, throughCoolant } = answers
  const diameter = answers.diameter
  const ratio = answers.depth / diameter
  if (feature === 'flat') return typeFits('flat-bottom', diameter) ? 'flat-bottom' : null
  if (feature === 'chamfer') return typeFits('countersink', diameter) ? 'countersink' : null
  if (feature === 'steps') return typeFits('step', diameter) ? 'step' : null
  if (feature === 'center') return 'center'
  if (ratio >= 12 && typeFits('gun', diameter)) return 'gun'
  if (diameter <= 1 && typeFits('micro', diameter)) return 'micro'
  if (material === 'brass' && typeFits('straight', diameter)) return 'straight'
  if (ratio <= 0.4 && typeFits('spot120', diameter)) return 'spot120'
  if (ratio >= 4 && tough(material) && throughCoolant === 'yes' && typeFits('coolant', diameter)) return 'coolant'
  if (ratio >= 8 && typeFits('parabolic', diameter)) return 'parabolic'
  if (ratio >= 4 && tough(material) && typeFits('parabolic', diameter)) return 'parabolic'
  if (ratio >= 4 && !typeFits('parabolic', diameter) && typeFits('taper', diameter)) return 'taper'
  if (ratio <= 2.5 && typeFits('stub', diameter)) return 'stub'
  if (typeFits('jobber', diameter)) return 'jobber'
  if (typeFits('gun', diameter)) return 'gun'
  return null
}

function reasonFor(typeId: DrillTypeId, answers: WizardAnswers): string {
  const ratio = answers.depth / Math.max(answers.diameter, 0.001)
  switch (typeId) {
    case 'flat-bottom':
      return 'A flat-bottom drill leaves a flat floor, with a small center point so it still tracks.'
    case 'countersink':
      return 'A drill/countersink combo cuts the hole and the chamfer on one tool.'
    case 'step':
      return 'A step drill cuts the small diameter and the larger one behind it.'
    case 'center':
      return 'A combined drill and countersink matches the nearest standard center size to that pilot.'
    case 'gun':
      return 'This hole is deep enough that a gun drill, with a bushing and coolant, is the conservative choice.'
    case 'micro':
      return 'Under about 1 mm this library uses a micro drill on a thicker shank.'
    case 'straight':
      return 'Brass and bronze can grab a twisted flute, so a straight flute is the safer start.'
    case 'spot120':
      return 'This only nicks the surface, so a 120° spot drill starts the hole instead of drilling it.'
    case 'spot90':
      return 'A 90° spot is for a short start or a small chamfer, not a deep hole.'
    case 'parabolic':
      return ratio >= 8
        ? 'The flute is long for a jobber. A parabolic flute gives chips more room to get out.'
        : 'Without coolant through the tool, a parabolic flute is the safer deep-hole twist drill.'
    case 'coolant':
      return 'A deeper hole in steel is more reliable when coolant comes out at the point.'
    case 'taper':
      return 'This is deeper than a jobber and larger than a parabolic drill in this library, so a long-series twist is the fit.'
    case 'stub':
      return 'The hole is shallow, so a short stub drill stays stiffer than a jobber.'
    case 'jobber':
      return 'A jobber twist drill is the ordinary tool for a hole a few diameters deep.'
    case 'subland':
      return 'A subland cuts two diameters, each with its own land.'
    case 'core':
      return 'A core drill only opens a hole that already exists.'
    case 'double-margin':
      return 'A second margin steadies a production drill in the hole.'
    default: {
      const exhaustive: never = typeId
      return exhaustive
    }
  }
}

function notesFor(typeId: DrillTypeId, answers: WizardAnswers, clipped: boolean): string[] {
  const notes: string[] = []
  notes.push('Defaults are carbide with a conservative point and web. Change Material if the blank is HSS.')
  if (clipped) {
    notes.push('The flute was shortened to stay inside what this drill family allows. Check that it still reaches the hole.')
  }
  if (typeId === 'gun') {
    notes.push('A gun drill needs a guide bushing and coolant. It is not a drop-in replacement for a twist drill.')
  }
  if (typeId === 'coolant') {
    notes.push('Only use this if the holder can actually push coolant through the tool.')
  }
  if (typeId === 'parabolic' && answers.throughCoolant === 'yes' && tough(answers.material)) {
    notes.push('Coolant-through would be the stronger choice in this material if you switch the machine setup.')
  }
  if (typeId === 'spot120') {
    notes.push('Spot the location, then drill the hole with a twist drill. This tool does not finish the depth.')
  }
  if (typeId === 'center') {
    notes.push('Center drills are fixed ANSI sizes. Change Center size if the print calls out a different number.')
  }
  if (typeId === 'step' && answers.depth / answers.diameter > 3) {
    notes.push('Step drills are for short holes. A deep stepped hole is happier as two separate drills.')
  }
  if (answers.material === 'plastic') {
    notes.push('Plastics can melt and close up. Peck, clear the chips, and keep the point sharp — this does not set a speed.')
  }
  if (answers.material === 'hardened' && typeId !== 'coolant' && typeId !== 'gun') {
    notes.push('Hardened steel needs carbide. Confirm the blank before you grind an HSS tool for this.')
  }
  if (answers.material === 'unsure') {
    notes.push('118° jobber geometry is the general-purpose start until the material is known.')
  }
  return notes
}

export function recommendDrill(answers: WizardAnswers): DrillRecommendation {
  const { diameter, depth } = answers
  if (!Number.isFinite(diameter) || !Number.isFinite(depth) || diameter <= 0 || depth <= 0) {
    return {
      ok: false,
      drill: null,
      reason: 'Enter a hole diameter and a depth greater than zero.',
      notes: [],
    }
  }
  if (diameter > 50 || (diameter > 40 && depth / diameter < 12)) {
    return {
      ok: false,
      drill: null,
      reason: 'This library stops at 40 mm for a twist drill, and 50 mm for a gun drill. Enter a smaller hole or pick a type yourself.',
      notes: [],
    }
  }
  if (diameter < 0.05) {
    return {
      ok: false,
      drill: null,
      reason: 'Micro drills in this library start at 0.05 mm.',
      notes: [],
    }
  }
  const typeId = chooseType(answers)
  if (!typeId) {
    return {
      ok: false,
      drill: null,
      reason: 'No library drill fits that diameter. Pick a type yourself and the form will show why if a value is out of range.',
      notes: [],
    }
  }
  const sized = sizeDrill(typeId, diameter, depth, answers.material)
  if (!sized) {
    return {
      ok: false,
      drill: null,
      reason: 'A safe default for that combination did not fit this library. Pick a type and edit the fields.',
      notes: [],
    }
  }
  return {
    ok: true,
    drill: sized.drill,
    reason: reasonFor(typeId, answers),
    notes: notesFor(typeId, answers, sized.clipped),
  }
}

const ALTERNATIVE_ORDER: readonly DrillTypeId[] = [
  'jobber',
  'stub',
  'spot120',
  'straight',
  'parabolic',
  'coolant',
  'gun',
  'countersink',
  'flat-bottom',
  'step',
]

export function alternativeDrills(answers: WizardAnswers, chosen: DrillTypeId): DrillAlternative[] {
  const found: DrillAlternative[] = []
  for (const typeId of ALTERNATIVE_ORDER) {
    if (typeId === chosen) continue
    if (!typeFits(typeId, answers.diameter) && typeId !== 'center') continue
    const sized = sizeDrill(typeId, answers.diameter, answers.depth, answers.material)
    if (!sized) continue
    found.push({ drill: sized.drill, reason: reasonFor(typeId, answers) })
    if (found.length >= 3) break
  }
  return found
}

function lengthRatio(drill: DrillParams): number {
  if (!(drill.diameter > 0)) return 0
  return drill.fluteLength / drill.diameter
}

/**
 * Soft suggestions. These do not block save or export — hard errors stay in validateDrill.
 * Material comments are skipped unless a workpiece was chosen in the wizard or a template.
 */
export function adviseDrill(drill: DrillParams, workpiece: WorkpieceMaterial | null): DrillAdvisory[] {
  const notes: DrillAdvisory[] = []
  const ratio = lengthRatio(drill)
  const typeId = drill.drillType

  if (typeId === 'gun' && ratio < 4) {
    notes.push({
      id: 'gun-short',
      message:
        'Gun drills are for deep holes and need a guide bushing plus coolant. A jobber or stub is the usual tool for a short hole.',
      adopt: 'jobber',
    })
  } else if (ratio >= 15 && typeId !== 'gun') {
    notes.push({
      id: 'very-deep',
      message:
        'This flute is about 15 diameters long or more. A gun drill, with a bushing and coolant, is the usual tool past a twist drill.',
      adopt: 'gun',
    })
  } else if (ratio >= 8 && SHORT_FLUTE_TYPES.has(typeId)) {
    notes.push({
      id: 'deep-twist',
      message:
        'This flute is long for a standard twist drill. A parabolic flute clears chips better, and a gun drill is the next step if it gets deeper.',
      adopt: 'parabolic',
    })
  } else if (
    workpiece &&
    tough(workpiece) &&
    ratio >= 4 &&
    typeId !== 'coolant' &&
    typeId !== 'gun' &&
    typeId !== 'parabolic'
  ) {
    notes.push({
      id: 'steel-coolant',
      message:
        'A deeper hole in steel or stainless is usually more reliable with coolant through the drill, if the machine can push it. A parabolic flute is the fallback when it cannot.',
      adopt: 'coolant',
    })
  }

  if ((typeId === 'spot90' || typeId === 'spot120') && drill.fluteLength > drill.diameter * 2) {
    notes.push({
      id: 'spot-long',
      message: 'Spot drills only nick the surface. A flute this long is a twist drill’s job.',
      adopt: 'jobber',
    })
  }

  if ((typeId === 'coolant' || typeId === 'gun') && drill.coolantHoles <= 0) {
    notes.push({
      id: 'coolant-off',
      message:
        typeId === 'gun'
          ? 'A gun drill needs the coolant hole down the tube. Turn it back on, or pick a twist drill.'
          : 'This family is meant to push coolant through the tool. Add the coolant holes, or switch to a parabolic flute if the machine cannot.',
      adopt: typeId === 'gun' ? undefined : 'parabolic',
    })
  }

  if (workpiece === 'aluminum' && drill.pointAngle >= 140 && (typeId === 'jobber' || typeId === 'stub' || typeId === 'taper')) {
    notes.push({
      id: 'al-point',
      message: 'Aluminum is usually drilled with a sharper point, about 118–130°. A 140° point is aimed at steel.',
    })
  } else if (workpiece === 'cast-iron' && drill.pointAngle >= 135 && typeId !== 'spot90' && typeId !== 'flat-bottom') {
    notes.push({
      id: 'iron-point',
      message: 'Cast iron is usually happier with a sharper point, around 118°.',
    })
  } else if (workpiece === 'plastic' && drill.pointAngle >= 135 && typeId !== 'flat-bottom') {
    notes.push({
      id: 'plastic-point',
      message: 'Plastics are usually drilled with a sharper point, around 118°, so the hole is less likely to melt and close.',
    })
  } else if (typeId === 'jobber' && drill.pointAngle <= 100) {
    notes.push({
      id: 'sharp-jobber',
      message: 'A point this sharp is unusual on a jobber. 118° is the general-purpose angle.',
    })
  }

  if (workpiece === 'brass' && drill.helixAngle > 10 && typeId !== 'straight' && typeId !== 'gun') {
    notes.push({
      id: 'brass-helix',
      message: 'Brass can grab a twisted flute and pull the drill in. A straight flute is the safer starting point.',
      adopt: 'straight',
    })
  }

  if (workpiece === 'hardened' && drill.material === 'HSS') {
    notes.push({
      id: 'hardened-hss',
      message: 'Hardened steel is a carbide job. High-speed steel will rub rather than cut.',
    })
  }

  return notes
}

/** Keep the current diameter and flute when the other family can accept them. */
export function adoptType(current: DrillParams, typeId: DrillTypeId): DrillParams | null {
  if (typeId === current.drillType || typeId === 'center') return null
  const sized = sizeDrill(typeId, current.diameter, Math.max(current.fluteLength, current.diameter * 0.5), 'unsure')
  if (!sized) return null
  const next: DrillParams = {
    ...sized.drill,
    name: current.name.trim() ? current.name : sized.drill.name,
    fluteLength: current.fluteLength,
  }
  if (typeId === 'step') {
    return valid(sized.drill) ? { ...sized.drill, name: next.name } : null
  }
  if (typeId === 'countersink' || typeId === 'spot90' || typeId === 'spot120' || typeId === 'flat-bottom') {
    return valid(sized.drill) ? { ...sized.drill, name: next.name } : null
  }
  const limits = getDrillType(typeId).limits
  if (next.fluteLength < limits.fluteLength.min || next.fluteLength > limits.fluteLength.max) {
    return valid(sized.drill) ? sized.drill : null
  }
  if (next.fluteLength + next.shankLength > next.overallLength) {
    const oal = roundMm(next.fluteLength + next.shankLength + 2)
    if (oal <= limits.overallLength.max) next.overallLength = oal
  }
  if (next.pointAngle < limits.pointAngle.min || next.pointAngle > limits.pointAngle.max) {
    next.pointAngle = sized.drill.pointAngle
  }
  return valid(next) ? next : valid(sized.drill) ? sized.drill : null
}

function templateDrill(patch: Partial<DrillParams> & Pick<DrillParams, 'drillType' | 'name'>): DrillParams {
  const base = createDrill(patch.drillType)
  return {
    ...base,
    ...patch,
    steps: patch.steps ? patch.steps.map((step) => ({ ...step })) : base.steps.map((step) => ({ ...step })),
  }
}

export function starterTemplates(): StarterTemplate[] {
  return [
    {
      id: 'al-6-3d',
      title: '6 mm hole in aluminum, 3×D',
      blurb: 'Ordinary jobber, 130° point, flute a little longer than an 18 mm hole.',
      workpiece: 'aluminum',
      drill: templateDrill({
        drillType: 'jobber',
        name: 'AL-6-130',
        diameter: 6,
        pointAngle: 130,
        helixAngle: 30,
        fluteLength: 22,
        overallLength: 66,
        shankDiameter: 6,
        shankLength: 40,
        webThickness: 1.08,
        webThinning: 'split',
        marginWidth: 0.45,
        bodyClearance: 0.04,
        lipReliefAngle: 10,
        backTaper: 0.03,
        coolantHoles: 0,
        material: 'carbide',
        coating: 'TiN',
      }),
    },
    {
      id: 'steel-spot-drill',
      title: 'Spot, then drill, in steel',
      blurb: 'This is the 10 mm, 135° hole drill. Spot the location first with a 120° spot drill so the point does not walk.',
      workpiece: 'mild-steel',
      drill: templateDrill({
        drillType: 'jobber',
        name: 'STEEL-10-135',
        diameter: 10,
        pointAngle: 135,
        helixAngle: 30,
        fluteLength: 36,
        overallLength: 89,
        shankDiameter: 10,
        shankLength: 48,
        webThickness: 1.6,
        webThinning: 'split',
        marginWidth: 0.7,
        bodyClearance: 0.05,
        lipReliefAngle: 9,
        backTaper: 0.03,
        coolantHoles: 0,
        material: 'carbide',
        coating: 'TiAlN',
      }),
    },
    {
      id: 'ss-deep',
      title: 'Deep hole in stainless',
      blurb: '8 mm coolant-through carbide, about 10×D, 140° point. If the machine cannot push coolant through the tool, switch to the parabolic template.',
      workpiece: 'stainless',
      drill: templateDrill({
        drillType: 'coolant',
        name: 'SS-8-140-CT',
        diameter: 8,
        pointAngle: 140,
        helixAngle: 30,
        fluteLength: 83,
        overallLength: 137,
        shankDiameter: 8,
        shankLength: 48,
        webThickness: 2,
        webThinning: 'X',
        marginWidth: 0.5,
        bodyClearance: 0.04,
        lipReliefAngle: 8,
        backTaper: 0.02,
        coolantHoles: 2,
        coolantHoleDiameter: 0.7,
        material: 'carbide',
        coating: 'AlTiN',
      }),
    },
    {
      id: 'step-sheet',
      title: 'Step drill for sheet',
      blurb: '4 mm tip, then 8 mm, both short — a sheet or shallow stepped hole, not a deep one.',
      workpiece: 'aluminum',
      drill: templateDrill({
        drillType: 'step',
        name: 'STEP-SHEET-4-8',
        diameter: 4,
        pointAngle: 118,
        helixAngle: 30,
        fluteCount: 2,
        steps: [
          { diameter: 4, length: 8 },
          { diameter: 8, length: 6 },
        ],
        fluteLength: 14,
        overallLength: 55,
        shankDiameter: 8,
        shankLength: 35,
        webThickness: 0.72,
        webThinning: 'split',
        marginWidth: 0.3,
        bodyClearance: 0.03,
        lipReliefAngle: 10,
        backTaper: 0.02,
        material: 'carbide',
        coating: 'TiN',
      }),
    },
    {
      id: 'brass-straight',
      title: 'Straight flute for brass',
      blurb: 'Zero helix so the drill is less likely to grab in brass or bronze.',
      workpiece: 'brass',
      drill: templateDrill({
        drillType: 'straight',
        name: 'BRASS-8-118',
        diameter: 8,
        pointAngle: 118,
        helixAngle: 0,
        fluteLength: 30,
        overallLength: 80,
        shankDiameter: 8,
        shankLength: 45,
        webThickness: 1.3,
        webThinning: 'none',
        marginWidth: 0.5,
        bodyClearance: 0.05,
        lipReliefAngle: 12,
        backTaper: 0.02,
        coolantHoles: 0,
        material: 'carbide',
        coating: 'uncoated',
      }),
    },
    {
      id: 'm6-tap',
      title: 'M6×1 tap drill',
      blurb: 'ISO metric coarse M6×1 uses a 5.0 mm tap drill. This is the hole drill only — it does not describe a tapping cycle.',
      workpiece: 'mild-steel',
      drill: templateDrill({
        drillType: 'jobber',
        name: 'M6-TAP-5.0',
        diameter: 5,
        pointAngle: 118,
        helixAngle: 30,
        fluteLength: 24,
        overallLength: 66,
        shankDiameter: 5,
        shankLength: 36,
        webThickness: 0.9,
        webThinning: 'split',
        marginWidth: 0.4,
        bodyClearance: 0.04,
        lipReliefAngle: 10,
        backTaper: 0.03,
        coolantHoles: 0,
        material: 'carbide',
        coating: 'TiN',
      }),
    },
  ]
}

export function previewPartLabel(part: PreviewPart): string {
  switch (part) {
    case 'point':
      return 'point'
    case 'flute':
      return 'flutes'
    case 'shank':
      return 'shank'
    case 'coolant':
      return 'coolant holes'
    case 'step':
      return 'steps'
    case 'chamfer':
      return 'chamfer'
    case 'web':
      return 'web'
    case 'margin':
      return 'margin'
    default: {
      const exhaustive: never = part
      return exhaustive
    }
  }
}

/** Every library id is present. Used by tests to catch a missing card or field list. */
export function allDrillTypeIds(): readonly DrillTypeId[] {
  return DRILL_TYPE_IDS
}
