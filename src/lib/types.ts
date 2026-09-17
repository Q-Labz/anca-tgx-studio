export type ToolType = 'endmill' | 'drill'
export type ToolMaterial = 'carbide' | 'HSS'

export interface EndmillParams {
  name: string
  diameter: number
  fluteCount: number
  helixAngle: number
  overallLength: number
  fluteLength: number
  shankDiameter: number
  shankLength: number
  cornerRadius: number
  neckDiameter: number | null
  neckLength: number | null
  coating: string
  material: ToolMaterial
}

export interface DrillParams {
  name: string
  diameter: number
  pointAngle: number
  fluteCount: number
  overallLength: number
  fluteLength: number
  shankDiameter: number
  shankLength: number
  webThinningNote: string
  coating: string
  material: ToolMaterial
}

export type ToolParams = EndmillParams | DrillParams

export interface SavedDesign {
  id: string
  toolType: ToolType
  params: ToolParams
  createdAt: string
  updatedAt: string
}

export interface WheelRow {
  id: string
  name: string
  grit: string
  size: string
}

export interface OpStep {
  id: string
  label: string
  done: boolean
  notes: string
}

export interface JobTraveler {
  id: string
  designId: string | null
  designName: string
  toolType: ToolType | null
  jobNumber: string
  customerPo: string
  quantity: number
  date: string
  blankDiameter: number
  blankLength: number
  blankMaterial: string
  supplierLot: string
  wheels: WheelRow[]
  ops: OpStep[]
  machine: string
  operator: string
  notes: string
  /** Optional ToolRoom .TOM filename reference (metadata only — not a binary) */
  toolroomTomFilename: string
  createdAt: string
  updatedAt: string
}

export const DEFAULT_ENDMILL: EndmillParams = {
  name: 'EM-10-4F',
  diameter: 10,
  fluteCount: 4,
  helixAngle: 30,
  overallLength: 75,
  fluteLength: 25,
  shankDiameter: 10,
  shankLength: 40,
  cornerRadius: 0,
  neckDiameter: null,
  neckLength: null,
  coating: 'AlTiN',
  material: 'carbide',
}

export const DEFAULT_DRILL: DrillParams = {
  name: 'DR-8-118',
  diameter: 8,
  pointAngle: 118,
  fluteCount: 2,
  overallLength: 80,
  fluteLength: 45,
  shankDiameter: 8,
  shankLength: 30,
  webThinningNote: '',
  coating: 'TiN',
  material: 'carbide',
}

export const DEFAULT_TGX_OPS: Omit<OpStep, 'id'>[] = [
  { label: 'Mount blank in collet / chuck', done: false, notes: '' },
  { label: 'Probe blank (length / diameter)', done: false, notes: '' },
  { label: 'Grind OD / blank diameter', done: false, notes: '' },
  { label: 'Grind flutes', done: false, notes: '' },
  { label: 'Grind end face / point', done: false, notes: '' },
  { label: 'Grind corners / radii', done: false, notes: '' },
  { label: 'Relief / clearance grind', done: false, notes: '' },
  { label: 'Inspect dimensions & finish', done: false, notes: '' },
  { label: 'Deburr / clean / pack', done: false, notes: '' },
]

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function makeDefaultOps(): OpStep[] {
  return DEFAULT_TGX_OPS.map((op) => ({ ...op, id: uid('op') }))
}

export function makeEmptyTraveler(partial?: Partial<JobTraveler>): JobTraveler {
  const now = new Date().toISOString()
  return {
    id: uid('trav'),
    designId: null,
    designName: '',
    toolType: null,
    jobNumber: '',
    customerPo: '',
    quantity: 1,
    date: new Date().toISOString().slice(0, 10),
    blankDiameter: 10,
    blankLength: 80,
    blankMaterial: 'Carbide rod',
    supplierLot: '',
    wheels: [
      { id: uid('wh'), name: '1A1 OD', grit: '120', size: '100×10×20' },
      { id: uid('wh'), name: '1V1 Flute', grit: '220', size: '100×6×20' },
    ],
    ops: makeDefaultOps(),
    machine: 'ANCA TGX',
    operator: '',
    notes: '',
    toolroomTomFilename: '',
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}
