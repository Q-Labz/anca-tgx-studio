import { frustumHeight, roundMm } from './drillMath'
import type {
  CenterDrillSize,
  DrillParams,
  DrillStep,
  DrillTypeId,
  GunFluteStyle,
  ToolMaterial,
  WebThinningStyle,
} from './types'
import {
  CENTER_DRILL_SIZES,
  DRILL_TYPE_IDS,
  GUN_FLUTE_STYLES,
  WEB_THINNING_STYLES,
} from './types'

export type DrillFieldKey =
  | 'name'
  | 'diameter'
  | 'pointAngle'
  | 'fluteCount'
  | 'helixAngle'
  | 'overallLength'
  | 'fluteLength'
  | 'shankDiameter'
  | 'shankLength'
  | 'webThickness'
  | 'webThinning'
  | 'webThinningNote'
  | 'marginWidth'
  | 'bodyClearance'
  | 'lipReliefAngle'
  | 'backTaper'
  | 'coolantHoles'
  | 'coolantHoleDiameter'
  | 'steps'
  | 'sublandDiameter'
  | 'sublandLength'
  | 'centerSize'
  | 'countersinkAngle'
  | 'countersinkDiameter'
  | 'pilotLength'
  | 'chamferAngle'
  | 'chamferDiameter'
  | 'gunFluteStyle'
  | 'coating'
  | 'material'

export interface Range {
  min: number
  max: number
}

export interface DrillLimits {
  diameter: Range
  pointAngle: Range
  fluteCount: Range
  helixAngle: Range
  overallLength: Range
  fluteLength: Range
  shankDiameter: Range
  shankLength: Range
}

export interface DrillTypeDef {
  id: DrillTypeId
  label: string
  shortLabel: string
  group: string
  summary: string
  fields: readonly DrillFieldKey[]
  limits: DrillLimits
  pointChips: readonly number[]
  /** Replaces the generic range message when a value falls outside the type. */
  messages?: Partial<Record<'diameter' | 'pointAngle' | 'fluteCount' | 'helixAngle', string>>
  defaults: DrillParams
}

export const DRILL_GROUPS = [
  'Length series',
  'Pointing',
  'Combined',
  'Multi-diameter',
  'High performance',
  'Specialty',
] as const

const r = (min: number, max: number): Range => ({ min, max })

const TWIST_FIELDS = [
  'name',
  'diameter',
  'pointAngle',
  'fluteCount',
  'helixAngle',
  'overallLength',
  'fluteLength',
  'shankDiameter',
  'shankLength',
  'webThickness',
  'webThinning',
  'marginWidth',
  'bodyClearance',
  'lipReliefAngle',
  'backTaper',
  'coolantHoles',
  'coolantHoleDiameter',
  'coating',
  'material',
  'webThinningNote',
] as const satisfies readonly DrillFieldKey[]

const TWIST_LIMITS: DrillLimits = {
  diameter: r(0.2, 40),
  pointAngle: r(60, 180),
  fluteCount: r(2, 3),
  helixAngle: r(5, 50),
  overallLength: r(8, 400),
  fluteLength: r(0.5, 320),
  shankDiameter: r(0.2, 40),
  shankLength: r(1, 250),
}

function blankDrill(over: Partial<DrillParams> & Pick<DrillParams, 'name' | 'drillType'>): DrillParams {
  const defaults: DrillParams = {
    name: over.name,
    drillType: over.drillType,
    diameter: 8,
    pointAngle: 118,
    fluteCount: 2,
    helixAngle: 30,
    overallLength: 80,
    fluteLength: 40,
    shankDiameter: 8,
    shankLength: 35,
    webThickness: 1.2,
    webThinning: 'none',
    webThinningNote: '',
    marginWidth: 0.5,
    bodyClearance: 0.05,
    lipReliefAngle: 10,
    backTaper: 0.03,
    coolantHoles: 0,
    coolantHoleDiameter: 0.8,
    steps: [],
    sublandDiameter: 12,
    sublandLength: 12,
    centerSize: '#3',
    countersinkAngle: 60,
    countersinkDiameter: 12,
    pilotLength: 4,
    chamferAngle: 90,
    chamferDiameter: 12,
    gunFluteStyle: 'single',
    coating: 'TiN',
    material: 'carbide',
  }
  return {
    ...defaults,
    ...over,
    steps: over.steps ? over.steps.map((step) => ({ ...step })) : [],
  }
}

interface CenterSpec {
  size: CenterDrillSize
  /** Pilot (drill) diameter, mm */
  pilot: number
  pilotLength: number
  /** Countersink / body diameter, mm */
  body: number
  overallLength: number
}

/** ANSI combined drill and countersink inch sizes, converted to mm. */
export const CENTER_DRILL_SPECS: readonly CenterSpec[] = [
  { size: '#00', pilot: 0.64, pilotLength: 0.76, body: 3.18, overallLength: 28.58 },
  { size: '#0', pilot: 0.79, pilotLength: 0.97, body: 3.18, overallLength: 28.58 },
  { size: '#1', pilot: 1.19, pilotLength: 1.19, body: 3.18, overallLength: 31.75 },
  { size: '#2', pilot: 1.98, pilotLength: 1.98, body: 4.76, overallLength: 47.63 },
  { size: '#3', pilot: 2.78, pilotLength: 2.78, body: 6.35, overallLength: 50.8 },
  { size: '#4', pilot: 3.18, pilotLength: 3.18, body: 7.94, overallLength: 53.98 },
  { size: '#5', pilot: 4.76, pilotLength: 4.76, body: 11.11, overallLength: 69.85 },
  { size: '#6', pilot: 5.56, pilotLength: 5.56, body: 12.7, overallLength: 76.2 },
  { size: '#7', pilot: 6.35, pilotLength: 6.35, body: 15.88, overallLength: 82.55 },
  { size: '#8', pilot: 7.94, pilotLength: 7.94, body: 19.05, overallLength: 88.9 },
]

export function centerDrillSpec(size: CenterDrillSize): CenterSpec {
  const spec = CENTER_DRILL_SPECS.find((item) => item.size === size)
  if (!spec) {
    throw new Error(`Unknown center drill size ${size}`)
  }
  return spec
}

/** Geometry for one combined drill and countersink size, keeping coating and material. */
export function applyCenterDrillSize(current: DrillParams, size: CenterDrillSize): DrillParams {
  const spec = centerDrillSpec(size)
  const countersinkAngle = 60
  const cone = frustumHeight(spec.pilot, spec.body, countersinkAngle)
  const fluteLength = roundMm(spec.pilotLength + cone)
  const shankLength = roundMm(Math.max(spec.overallLength - fluteLength - 0.4, 1))
  return {
    ...current,
    name: `CD-${size}-60`,
    drillType: 'center',
    centerSize: size,
    diameter: spec.pilot,
    pilotLength: spec.pilotLength,
    countersinkDiameter: spec.body,
    countersinkAngle,
    pointAngle: 118,
    fluteCount: 2,
    helixAngle: 15,
    overallLength: spec.overallLength,
    fluteLength,
    shankDiameter: spec.body,
    shankLength,
    webThickness: roundMm(spec.pilot * 0.2, 3),
    marginWidth: roundMm(Math.max(0.04, spec.pilot * 0.08), 3),
    bodyClearance: roundMm(Math.max(0.01, spec.pilot * 0.02), 3),
  }
}

function centerDefaults(): DrillParams {
  return applyCenterDrillSize(
    blankDrill({ name: 'CD-#3-60', drillType: 'center', material: 'carbide', coating: 'TiN' }),
    '#3',
  )
}

const SPOT_FIELDS = [
  'name',
  'diameter',
  'pointAngle',
  'fluteCount',
  'helixAngle',
  'overallLength',
  'fluteLength',
  'shankDiameter',
  'shankLength',
  'webThickness',
  'lipReliefAngle',
  'marginWidth',
  'coating',
  'material',
] as const satisfies readonly DrillFieldKey[]

const stepDefaults: DrillStep[] = [
  { diameter: 6, length: 15 },
  { diameter: 10, length: 12 },
  { diameter: 14, length: 10 },
]

export const DRILL_REGISTRY: Record<DrillTypeId, DrillTypeDef> = {
  jobber: {
    id: 'jobber',
    label: 'Jobber twist drill',
    shortLabel: 'Jobber',
    group: 'Length series',
    summary:
      'Standard twist drill in jobber length (about DIN 338). Two flutes, 118° point, split-point web on carbide.',
    fields: TWIST_FIELDS,
    limits: TWIST_LIMITS,
    pointChips: [118, 135, 140],
    defaults: blankDrill({
      name: 'DR-8-118-JOBBER',
      drillType: 'jobber',
      diameter: 8,
      pointAngle: 118,
      helixAngle: 30,
      overallLength: 117,
      fluteLength: 75,
      shankDiameter: 8,
      shankLength: 37,
      webThickness: 1.2,
      webThinning: 'split',
      marginWidth: 0.6,
      bodyClearance: 0.05,
      lipReliefAngle: 10,
      backTaper: 0.04,
      coating: 'TiN',
    }),
  },
  stub: {
    id: 'stub',
    label: 'Stub / screw-machine drill',
    shortLabel: 'Stub',
    group: 'Length series',
    summary:
      'Short screw-machine length (about DIN 1897). Stiffer than a jobber for shallow holes and fixture work.',
    fields: TWIST_FIELDS,
    limits: { ...TWIST_LIMITS, overallLength: r(8, 200), fluteLength: r(0.5, 120) },
    pointChips: [118, 135, 140],
    defaults: blankDrill({
      name: 'DR-8-118-STUB',
      drillType: 'stub',
      diameter: 8,
      pointAngle: 118,
      helixAngle: 30,
      overallLength: 79,
      fluteLength: 37,
      shankDiameter: 8,
      shankLength: 38,
      webThickness: 1.2,
      webThinning: 'split',
      marginWidth: 0.55,
      coating: 'TiN',
    }),
  },
  taper: {
    id: 'taper',
    label: 'Taper-length / long series',
    shortLabel: 'Taper / long',
    group: 'Length series',
    summary:
      'Taper-length and long-series twist (about DIN 340). Longer flute for deeper holes without a gun drill.',
    fields: TWIST_FIELDS,
    limits: { ...TWIST_LIMITS, overallLength: r(30, 450), fluteLength: r(10, 360) },
    pointChips: [118, 135, 140],
    defaults: blankDrill({
      name: 'DR-8-118-LONG',
      drillType: 'taper',
      diameter: 8,
      pointAngle: 118,
      helixAngle: 30,
      overallLength: 165,
      fluteLength: 109,
      shankDiameter: 8,
      shankLength: 50,
      webThickness: 1.25,
      webThinning: 'split',
      marginWidth: 0.55,
      backTaper: 0.03,
      coating: 'TiN',
    }),
  },
  spot90: {
    id: 'spot90',
    label: 'Spot drill 90°',
    shortLabel: 'Spot 90°',
    group: 'Pointing',
    summary: 'Short spotting drill with a 90° point. Spots a hole and leaves a 90° chamfer lead.',
    fields: SPOT_FIELDS,
    limits: {
      diameter: r(1, 30),
      pointAngle: r(80, 100),
      fluteCount: r(2, 3),
      helixAngle: r(0, 35),
      overallLength: r(15, 160),
      fluteLength: r(0.5, 40),
      shankDiameter: r(1, 32),
      shankLength: r(5, 140),
    },
    pointChips: [90],
    messages: {
      pointAngle:
        'A 90° spot drill needs a point angle of 80–100°. Use Spot 120° or a twist drill for a different point.',
    },
    defaults: blankDrill({
      name: 'SPOT-10-90',
      drillType: 'spot90',
      diameter: 10,
      pointAngle: 90,
      helixAngle: 12,
      overallLength: 75,
      fluteLength: 16,
      shankDiameter: 10,
      shankLength: 52,
      webThickness: 1.4,
      webThinning: 'none',
      marginWidth: 0.45,
      lipReliefAngle: 12,
      coating: 'TiAlN',
    }),
  },
  spot120: {
    id: 'spot120',
    label: 'Spot drill 120°',
    shortLabel: 'Spot 120°',
    group: 'Pointing',
    summary: 'Short spotting drill with a 120° point. Matches a 120° drill point and a common chamfer.',
    fields: SPOT_FIELDS,
    limits: {
      diameter: r(1, 30),
      pointAngle: r(110, 130),
      fluteCount: r(2, 3),
      helixAngle: r(0, 35),
      overallLength: r(15, 160),
      fluteLength: r(0.5, 40),
      shankDiameter: r(1, 32),
      shankLength: r(5, 140),
    },
    pointChips: [120],
    messages: {
      pointAngle:
        'A 120° spot drill needs a point angle of 110–130°. Use Spot 90° or a twist drill for a different point.',
    },
    defaults: blankDrill({
      name: 'SPOT-10-120',
      drillType: 'spot120',
      diameter: 10,
      pointAngle: 120,
      helixAngle: 12,
      overallLength: 75,
      fluteLength: 12,
      shankDiameter: 10,
      shankLength: 56,
      webThickness: 1.4,
      webThinning: 'none',
      marginWidth: 0.45,
      lipReliefAngle: 12,
      coating: 'TiAlN',
    }),
  },
  center: {
    id: 'center',
    label: 'Center drill (combined drill & countersink)',
    shortLabel: 'Center drill',
    group: 'Combined',
    summary:
      'Combined drill and countersink, ANSI sizes #00 through #8 (inch sizes shown in mm). 60° countersink is the usual center.',
    fields: [
      'name',
      'centerSize',
      'diameter',
      'pilotLength',
      'pointAngle',
      'countersinkAngle',
      'countersinkDiameter',
      'fluteCount',
      'overallLength',
      'fluteLength',
      'shankDiameter',
      'shankLength',
      'coating',
      'material',
    ],
    limits: {
      diameter: r(0.3, 12),
      pointAngle: r(90, 150),
      fluteCount: r(2, 2),
      helixAngle: r(0, 30),
      overallLength: r(15, 120),
      fluteLength: r(0.5, 40),
      shankDiameter: r(1, 25),
      shankLength: r(5, 100),
    },
    pointChips: [118],
    defaults: centerDefaults(),
  },
  step: {
    id: 'step',
    label: 'Step drill',
    shortLabel: 'Step',
    group: 'Multi-diameter',
    summary:
      'Multi-diameter step drill. Step 1 is the tip; each following step is a larger diameter. Lengths are the cutting length of that step.',
    fields: [
      'name',
      'steps',
      'pointAngle',
      'fluteCount',
      'helixAngle',
      'overallLength',
      'shankDiameter',
      'shankLength',
      'webThickness',
      'webThinning',
      'marginWidth',
      'bodyClearance',
      'lipReliefAngle',
      'backTaper',
      'coating',
      'material',
    ],
    limits: {
      diameter: r(0.5, 40),
      pointAngle: r(60, 180),
      fluteCount: r(2, 3),
      helixAngle: r(0, 45),
      overallLength: r(15, 300),
      fluteLength: r(1, 200),
      shankDiameter: r(1, 40),
      shankLength: r(5, 200),
    },
    pointChips: [118, 135, 90],
    defaults: blankDrill({
      name: 'STEP-6-10-14',
      drillType: 'step',
      diameter: 6,
      pointAngle: 118,
      helixAngle: 30,
      overallLength: 100,
      fluteLength: 37,
      shankDiameter: 14,
      shankLength: 55,
      webThickness: 0.9,
      webThinning: 'split',
      marginWidth: 0.4,
      bodyClearance: 0.04,
      steps: stepDefaults,
      coating: 'TiAlN',
    }),
  },
  subland: {
    id: 'subland',
    label: 'Subland drill',
    shortLabel: 'Subland',
    group: 'Multi-diameter',
    summary:
      'Two cutting diameters, each with its own land and point. The front land is the small diameter; the subland behind it is larger.',
    fields: [
      'name',
      'diameter',
      'fluteLength',
      'pointAngle',
      'sublandDiameter',
      'sublandLength',
      'fluteCount',
      'helixAngle',
      'overallLength',
      'shankDiameter',
      'shankLength',
      'webThickness',
      'webThinning',
      'marginWidth',
      'lipReliefAngle',
      'coating',
      'material',
    ],
    limits: {
      diameter: r(0.5, 40),
      pointAngle: r(60, 180),
      fluteCount: r(2, 3),
      helixAngle: r(5, 45),
      overallLength: r(20, 300),
      fluteLength: r(1, 150),
      shankDiameter: r(1, 40),
      shankLength: r(5, 200),
    },
    pointChips: [118, 135, 90],
    defaults: blankDrill({
      name: 'SUB-8-12',
      drillType: 'subland',
      diameter: 8,
      pointAngle: 118,
      fluteLength: 22,
      sublandDiameter: 12,
      sublandLength: 16,
      helixAngle: 30,
      overallLength: 100,
      shankDiameter: 12,
      shankLength: 52,
      webThickness: 1.2,
      webThinning: 'split',
      marginWidth: 0.5,
      lipReliefAngle: 10,
      coating: 'TiAlN',
    }),
  },
  coolant: {
    id: 'coolant',
    label: 'Coolant-through carbide drill',
    shortLabel: 'Coolant-through',
    group: 'High performance',
    summary:
      'Carbide high-performance drill with internal coolant holes, a thicker web, and a 140° point. Typical 5×D body.',
    fields: TWIST_FIELDS,
    limits: {
      ...TWIST_LIMITS,
      diameter: r(1, 32),
      pointAngle: r(110, 160),
      helixAngle: r(15, 45),
    },
    pointChips: [140, 145, 135],
    defaults: blankDrill({
      name: 'HP-8-140-CT',
      drillType: 'coolant',
      diameter: 8,
      pointAngle: 140,
      helixAngle: 30,
      overallLength: 103,
      fluteLength: 42,
      shankDiameter: 8,
      shankLength: 55,
      webThickness: 2,
      webThinning: 'X',
      marginWidth: 0.45,
      bodyClearance: 0.04,
      lipReliefAngle: 8,
      backTaper: 0.02,
      coolantHoles: 2,
      coolantHoleDiameter: 0.8,
      coating: 'AlTiN',
    }),
  },
  parabolic: {
    id: 'parabolic',
    label: 'Parabolic-flute deep-hole drill',
    shortLabel: 'Parabolic',
    group: 'High performance',
    summary:
      'Deep-hole twist with a wide parabolic flute, thick web, and a higher helix so chips can climb out of a 12×D hole.',
    fields: TWIST_FIELDS,
    limits: {
      ...TWIST_LIMITS,
      diameter: r(1, 25),
      pointAngle: r(118, 150),
      fluteCount: r(2, 2),
      helixAngle: r(25, 50),
      overallLength: r(40, 450),
      fluteLength: r(15, 380),
    },
    pointChips: [130, 135, 118],
    messages: {
      helixAngle: 'Parabolic flutes use a high helix, about 25–50°. Use a jobber or straight-flute drill for a lower helix.',
      fluteCount: 'Parabolic deep-hole drills are 2-flute.',
    },
    defaults: blankDrill({
      name: 'PAR-8-12D',
      drillType: 'parabolic',
      diameter: 8,
      pointAngle: 130,
      fluteCount: 2,
      helixAngle: 37,
      overallLength: 155,
      fluteLength: 100,
      shankDiameter: 8,
      shankLength: 48,
      webThickness: 2.8,
      webThinning: 'S',
      marginWidth: 0.35,
      bodyClearance: 0.03,
      lipReliefAngle: 9,
      backTaper: 0.02,
      coolantHoles: 0,
      coolantHoleDiameter: 0.9,
      coating: 'TiN',
    }),
  },
  gun: {
    id: 'gun',
    label: 'Gun drill',
    shortLabel: 'Gun drill',
    group: 'Specialty',
    summary:
      'Single-lip gun drill: straight V or single flute, a carbide head, and one coolant hole down the tube. V-flute is the two-flute variant.',
    fields: [
      'name',
      'diameter',
      'pointAngle',
      'gunFluteStyle',
      'fluteCount',
      'helixAngle',
      'overallLength',
      'fluteLength',
      'shankDiameter',
      'shankLength',
      'coolantHoles',
      'coolantHoleDiameter',
      'marginWidth',
      'lipReliefAngle',
      'coating',
      'material',
    ],
    limits: {
      diameter: r(0.8, 50),
      pointAngle: r(80, 160),
      fluteCount: r(1, 2),
      helixAngle: r(0, 5),
      overallLength: r(40, 900),
      fluteLength: r(15, 800),
      shankDiameter: r(0.8, 50),
      shankLength: r(10, 200),
    },
    pointChips: [120, 130],
    messages: {
      helixAngle: 'Gun drills are straight-flute tools. Keep the helix at 0–5°, or pick a twist drill.',
      fluteCount: 'Gun drills have 1 flute (single-lip) or 2 (V-flute / two-flute).',
    },
    defaults: blankDrill({
      name: 'GUN-8-250',
      drillType: 'gun',
      diameter: 8,
      pointAngle: 130,
      fluteCount: 1,
      helixAngle: 0,
      overallLength: 320,
      fluteLength: 250,
      shankDiameter: 8,
      shankLength: 60,
      gunFluteStyle: 'single',
      coolantHoles: 1,
      coolantHoleDiameter: 1.5,
      marginWidth: 0.3,
      lipReliefAngle: 15,
      coating: 'TiN',
    }),
  },
  straight: {
    id: 'straight',
    label: 'Straight-flute drill',
    shortLabel: 'Straight flute',
    group: 'Specialty',
    summary:
      'Zero-helix drill for brass, bronze, and other materials that grab a twist flute. Flutes run straight back from the point.',
    fields: TWIST_FIELDS,
    limits: {
      ...TWIST_LIMITS,
      helixAngle: r(0, 8),
    },
    pointChips: [118, 135, 90],
    messages: {
      helixAngle:
        'Straight-flute drills stay at 0–8° of helix. Use a jobber or parabolic drill for a real twist.',
    },
    defaults: blankDrill({
      name: 'SF-8-118',
      drillType: 'straight',
      diameter: 8,
      pointAngle: 118,
      helixAngle: 0,
      overallLength: 90,
      fluteLength: 45,
      shankDiameter: 8,
      shankLength: 40,
      webThickness: 1.3,
      webThinning: 'none',
      marginWidth: 0.5,
      bodyClearance: 0.05,
      lipReliefAngle: 12,
      backTaper: 0.02,
      coating: 'uncoated',
    }),
  },
  micro: {
    id: 'micro',
    label: 'Micro drill',
    shortLabel: 'Micro',
    group: 'Specialty',
    summary:
      'Carbide micro drill, 0.05–3 mm, usually on a reinforced 3 mm shank. Web and margin scale with the small diameter.',
    fields: TWIST_FIELDS,
    limits: {
      diameter: r(0.05, 3),
      pointAngle: r(90, 150),
      fluteCount: r(2, 2),
      helixAngle: r(10, 45),
      overallLength: r(10, 80),
      fluteLength: r(0.2, 25),
      shankDiameter: r(0.3, 6),
      shankLength: r(5, 70),
    },
    pointChips: [118, 130, 140],
    messages: {
      diameter: 'Micro drills are 0.05–3 mm. Use a jobber, stub, or coolant-through drill for larger diameters.',
      fluteCount: 'Micro drills in this library are 2-flute.',
    },
    defaults: blankDrill({
      name: 'MICRO-0.8',
      drillType: 'micro',
      diameter: 0.8,
      pointAngle: 130,
      fluteCount: 2,
      helixAngle: 30,
      overallLength: 38,
      fluteLength: 5,
      shankDiameter: 3,
      shankLength: 30,
      webThickness: 0.14,
      webThinning: 'none',
      marginWidth: 0.04,
      bodyClearance: 0.008,
      lipReliefAngle: 12,
      backTaper: 0.05,
      coolantHoles: 0,
      coolantHoleDiameter: 0.1,
      coating: 'TiAlN',
    }),
  },
  countersink: {
    id: 'countersink',
    label: 'Drill / countersink combination',
    shortLabel: 'Drill + c’sink',
    group: 'Combined',
    summary:
      'Drill point plus a chamfer behind it, so the hole and the countersink are ground on one tool. Chamfer angle is the included angle.',
    fields: [
      'name',
      'diameter',
      'pointAngle',
      'fluteLength',
      'chamferAngle',
      'chamferDiameter',
      'fluteCount',
      'helixAngle',
      'overallLength',
      'shankDiameter',
      'shankLength',
      'webThickness',
      'lipReliefAngle',
      'coating',
      'material',
    ],
    limits: {
      diameter: r(0.5, 30),
      pointAngle: r(60, 180),
      fluteCount: r(2, 3),
      helixAngle: r(0, 40),
      overallLength: r(15, 200),
      fluteLength: r(0.5, 80),
      shankDiameter: r(1, 32),
      shankLength: r(5, 150),
    },
    pointChips: [118, 135, 140],
    defaults: blankDrill({
      name: 'DCS-6-90',
      drillType: 'countersink',
      diameter: 6,
      pointAngle: 118,
      fluteCount: 2,
      helixAngle: 25,
      overallLength: 80,
      fluteLength: 16,
      shankDiameter: 10,
      shankLength: 55,
      webThickness: 0.9,
      lipReliefAngle: 10,
      chamferAngle: 90,
      chamferDiameter: 12,
      coating: 'TiN',
    }),
  },
  'flat-bottom': {
    id: 'flat-bottom',
    label: 'Flat-bottom drill',
    shortLabel: 'Flat bottom',
    group: 'Pointing',
    summary:
      '180° flat face for a flat hole bottom, with a small center point across the web so the drill still tracks.',
    fields: [
      'name',
      'diameter',
      'pointAngle',
      'fluteCount',
      'helixAngle',
      'overallLength',
      'fluteLength',
      'shankDiameter',
      'shankLength',
      'webThickness',
      'marginWidth',
      'lipReliefAngle',
      'coating',
      'material',
    ],
    limits: {
      diameter: r(1, 40),
      pointAngle: r(170, 180),
      fluteCount: r(2, 3),
      helixAngle: r(0, 40),
      overallLength: r(15, 250),
      fluteLength: r(1, 150),
      shankDiameter: r(1, 40),
      shankLength: r(5, 180),
    },
    pointChips: [180],
    messages: {
      pointAngle: 'Flat-bottom drills use a 170–180° face. Use a twist or spot drill for a sharper point.',
    },
    defaults: blankDrill({
      name: 'FB-10-180',
      drillType: 'flat-bottom',
      diameter: 10,
      pointAngle: 180,
      fluteCount: 2,
      helixAngle: 20,
      overallLength: 85,
      fluteLength: 25,
      shankDiameter: 10,
      shankLength: 52,
      webThickness: 1.5,
      marginWidth: 0.5,
      lipReliefAngle: 8,
      coating: 'TiAlN',
    }),
  },
  core: {
    id: 'core',
    label: 'Core drill',
    shortLabel: 'Core',
    group: 'Specialty',
    summary:
      '3- or 4-flute core drill that opens an existing hole. It does not cut the center, so the face is flat or only lightly chamfered.',
    fields: [
      'name',
      'diameter',
      'pointAngle',
      'fluteCount',
      'helixAngle',
      'overallLength',
      'fluteLength',
      'shankDiameter',
      'shankLength',
      'marginWidth',
      'bodyClearance',
      'coating',
      'material',
    ],
    limits: {
      diameter: r(4, 50),
      pointAngle: r(90, 180),
      fluteCount: r(3, 4),
      helixAngle: r(0, 30),
      overallLength: r(20, 300),
      fluteLength: r(2, 160),
      shankDiameter: r(4, 50),
      shankLength: r(10, 200),
    },
    pointChips: [180, 150, 118],
    messages: {
      fluteCount: 'Core drills use 3 or 4 flutes.',
    },
    defaults: blankDrill({
      name: 'CORE-16-4F',
      drillType: 'core',
      diameter: 16,
      pointAngle: 180,
      fluteCount: 4,
      helixAngle: 15,
      overallLength: 105,
      fluteLength: 35,
      shankDiameter: 16,
      shankLength: 62,
      marginWidth: 0.7,
      bodyClearance: 0.1,
      coating: 'TiAlN',
    }),
  },
  'double-margin': {
    id: 'double-margin',
    label: 'Double-margin drill',
    shortLabel: 'Double margin',
    group: 'High performance',
    summary:
      'Carbide drill with two margins per land for guidance in the hole, a 140° point, and coolant holes.',
    fields: TWIST_FIELDS,
    limits: {
      ...TWIST_LIMITS,
      diameter: r(2, 32),
      pointAngle: r(118, 160),
      helixAngle: r(15, 45),
    },
    pointChips: [140, 145, 135],
    defaults: blankDrill({
      name: 'DM-10-140',
      drillType: 'double-margin',
      diameter: 10,
      pointAngle: 140,
      helixAngle: 30,
      overallLength: 115,
      fluteLength: 52,
      shankDiameter: 10,
      shankLength: 55,
      webThickness: 2.4,
      webThinning: 'X',
      marginWidth: 0.55,
      bodyClearance: 0.05,
      lipReliefAngle: 8,
      backTaper: 0.03,
      coolantHoles: 2,
      coolantHoleDiameter: 1,
      coating: 'AlTiN',
    }),
  },
}

const DRILL_TYPE_SET = new Set<string>(DRILL_TYPE_IDS)

export function isDrillTypeId(value: unknown): value is DrillTypeId {
  return typeof value === 'string' && DRILL_TYPE_SET.has(value)
}

export function getDrillType(id: DrillTypeId): DrillTypeDef {
  return DRILL_REGISTRY[id]
}

export function listDrillTypes(): DrillTypeDef[] {
  const grouped: DrillTypeDef[] = []
  for (const group of DRILL_GROUPS) {
    for (const id of DRILL_TYPE_IDS) {
      const def = DRILL_REGISTRY[id]
      if (def.group === group) grouped.push(def)
    }
  }
  return grouped
}

export function drillTypeShows(id: DrillTypeId, key: DrillFieldKey): boolean {
  return DRILL_REGISTRY[id].fields.includes(key)
}

/** Fresh parameter set for a library type. Steps are copied so callers can edit them. */
export function createDrill(id: DrillTypeId): DrillParams {
  const src = DRILL_REGISTRY[id].defaults
  return {
    ...src,
    steps: src.steps.map((step) => ({ ...step })),
  }
}

export function withSteps(drill: DrillParams, steps: DrillStep[]): DrillParams {
  const next = steps.map((step) => ({ diameter: step.diameter, length: step.length }))
  const fluteLength = roundMm(next.reduce((sum, step) => sum + (Number.isFinite(step.length) ? step.length : 0), 0))
  return {
    ...drill,
    steps: next,
    diameter: next[0]?.diameter ?? drill.diameter,
    fluteLength,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isFinite(n) ? n : fallback
}

function hasOwn(src: Record<string, unknown>, key: string): boolean {
  const value = src[key]
  return value !== undefined && value !== null && value !== ''
}

function readWebThinning(value: unknown, fallback: WebThinningStyle): WebThinningStyle {
  return WEB_THINNING_STYLES.find((style) => style === value) ?? fallback
}

function readGunStyle(value: unknown, fallback: GunFluteStyle): GunFluteStyle {
  return GUN_FLUTE_STYLES.find((style) => style === value) ?? fallback
}

function readCenterSize(value: unknown, fallback: CenterDrillSize): CenterDrillSize {
  return CENTER_DRILL_SIZES.find((size) => size === value) ?? fallback
}

function readMaterial(value: unknown, fallback: ToolMaterial): ToolMaterial {
  return value === 'carbide' || value === 'HSS' ? value : fallback
}

function readSteps(value: unknown, fallback: DrillStep[]): DrillStep[] {
  if (!Array.isArray(value)) return fallback.map((step) => ({ ...step }))
  const steps: DrillStep[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const diameter = readNumber(item.diameter, NaN)
    const length = readNumber(item.length, NaN)
    if (Number.isFinite(diameter) && Number.isFinite(length)) steps.push({ diameter, length })
  }
  return steps.length > 0 ? steps : fallback.map((step) => ({ ...step }))
}

/**
 * Fill a stored drill so older designs (no drillType, no web / margin fields)
 * still open. Missing cross-section sizes scale with diameter.
 */
export function normalizeDrill(raw: unknown): DrillParams {
  const src = isRecord(raw) ? raw : {}
  const drillType = isDrillTypeId(src.drillType) ? src.drillType : 'jobber'
  const base = createDrill(drillType)
  const diameter = readNumber(src.diameter, base.diameter)
  const scale = base.diameter > 0 ? diameter / base.diameter : 1
  const scaled = (key: 'webThickness' | 'marginWidth' | 'bodyClearance' | 'coolantHoleDiameter') => {
    if (hasOwn(src, key)) return readNumber(src[key], base[key])
    return roundMm(base[key] * scale, 3)
  }

  const steps = readSteps(src.steps, base.steps)
  const drill: DrillParams = {
    ...base,
    name: typeof src.name === 'string' ? src.name : base.name,
    drillType,
    diameter,
    pointAngle: readNumber(src.pointAngle, base.pointAngle),
    fluteCount: readNumber(src.fluteCount, base.fluteCount),
    helixAngle: readNumber(src.helixAngle, base.helixAngle),
    overallLength: readNumber(src.overallLength, base.overallLength),
    fluteLength: readNumber(src.fluteLength, base.fluteLength),
    shankDiameter: readNumber(src.shankDiameter, base.shankDiameter),
    shankLength: readNumber(src.shankLength, base.shankLength),
    webThickness: scaled('webThickness'),
    webThinning: readWebThinning(src.webThinning, base.webThinning),
    webThinningNote: typeof src.webThinningNote === 'string' ? src.webThinningNote : base.webThinningNote,
    marginWidth: scaled('marginWidth'),
    bodyClearance: scaled('bodyClearance'),
    lipReliefAngle: readNumber(src.lipReliefAngle, base.lipReliefAngle),
    backTaper: readNumber(src.backTaper, base.backTaper),
    coolantHoles: readNumber(src.coolantHoles, base.coolantHoles),
    coolantHoleDiameter: scaled('coolantHoleDiameter'),
    steps,
    sublandDiameter: readNumber(src.sublandDiameter, base.sublandDiameter),
    sublandLength: readNumber(src.sublandLength, base.sublandLength),
    centerSize: readCenterSize(src.centerSize, base.centerSize),
    countersinkAngle: readNumber(src.countersinkAngle, base.countersinkAngle),
    countersinkDiameter: readNumber(src.countersinkDiameter, base.countersinkDiameter),
    pilotLength: readNumber(src.pilotLength, base.pilotLength),
    chamferAngle: readNumber(src.chamferAngle, base.chamferAngle),
    chamferDiameter: readNumber(src.chamferDiameter, base.chamferDiameter),
    gunFluteStyle: readGunStyle(src.gunFluteStyle, base.gunFluteStyle),
    coating: typeof src.coating === 'string' ? src.coating : base.coating,
    material: readMaterial(src.material, base.material),
  }

  if (drill.drillType === 'step' && !hasOwn(src, 'diameter') && drill.steps[0]) {
    drill.diameter = drill.steps[0].diameter
  }
  if (drill.drillType === 'step' && !hasOwn(src, 'fluteLength')) {
    drill.fluteLength = roundMm(drill.steps.reduce((sum, step) => sum + step.length, 0))
  }
  return drill
}

export function drillCaption(drill: DrillParams): string {
  const def = getDrillType(drill.drillType)
  switch (drill.drillType) {
    case 'step':
      return `${def.label} · ${drill.steps.length} steps · tip ⌀${drill.diameter} mm · ${drill.pointAngle}°`
    case 'gun':
      return `${def.label} · ${drill.gunFluteStyle === 'v' ? 'V-flute' : 'single flute'} · ⌀${drill.diameter} mm · ${drill.coolantHoles} coolant hole`
    case 'center':
      return `${def.label} · ${drill.centerSize} · pilot ⌀${drill.diameter} mm · ${drill.countersinkAngle}°`
    case 'countersink':
      return `${def.label} · ⌀${drill.diameter} mm · ${drill.chamferAngle}° chamfer to ⌀${drill.chamferDiameter} mm`
    case 'subland':
      return `${def.label} · ⌀${drill.diameter} / ⌀${drill.sublandDiameter} mm · ${drill.pointAngle}°`
    case 'spot90':
    case 'spot120':
    case 'flat-bottom':
      return `${def.label} · ⌀${drill.diameter} mm · ${drill.pointAngle}° point`
    case 'jobber':
    case 'stub':
    case 'taper':
    case 'coolant':
    case 'parabolic':
    case 'straight':
    case 'micro':
    case 'core':
    case 'double-margin':
      return `${def.label} · ⌀${drill.diameter} mm · ${drill.pointAngle}° · ${drill.fluteCount} flutes`
    default: {
      const exhaustive: never = drill.drillType
      return exhaustive
    }
  }
}
