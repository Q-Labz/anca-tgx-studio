import { getDrillType, normalizeDrill } from './drillTypes'
import type { DrillFieldKey } from './drillTypes'
import type {
  DrillParams,
  EndmillParams,
  GunFluteStyle,
  SavedDesign,
  ToolType,
  WebThinningStyle,
} from './types'
import { downloadBlob } from './export'

export const HANDOFF_DISCLAIMER =
  'ToolRoom creates the .TOM. This app does not write TOM files. Verify in CIM3D before grinding.'

export const HANDOFF_SCHEMA = 'toolroomHandoff' as const
export const HANDOFF_SCHEMA_VERSION = 1 as const

/** One row in the studio → typical iGrind / ToolRoom wizard map. */
export interface HandoffFieldRow {
  /** Studio JSON / form field name */
  studioKey: string
  /** Human label for the studio value */
  studioLabel: string
  /** Typical ToolRoom / iGrind wizard field label (labels vary by RN — verify in your release) */
  toolRoomLabel: string
  /** Display / copy value */
  value: string
  /** Unit hint for the handoff sheet */
  unit?: string
  /** Machine-readable value stored in `fields`. Falls back to the design object. */
  rawValue?: string | number | null
}

export interface ToolRoomHandoffPayload {
  schema: typeof HANDOFF_SCHEMA
  schemaVersion: typeof HANDOFF_SCHEMA_VERSION
  disclaimer: typeof HANDOFF_DISCLAIMER
  generatedAt: string
  toolType: ToolType
  designId: string | null
  /** Flat map keyed by studio field names — documented for script skeleton consumers */
  fields: Record<string, string | number | null>
  /** Ordered rows for UI / print */
  mapping: HandoffFieldRow[]
  notes: string[]
}

function fmt(v: string | number | null | undefined, empty = '—'): string {
  if (v === null || v === undefined || v === '') return empty
  return String(v)
}

export function buildEndmillMapping(p: EndmillParams): HandoffFieldRow[] {
  const rows: HandoffFieldRow[] = [
    {
      studioKey: 'name',
      studioLabel: 'Name',
      toolRoomLabel: 'Tool name / Description',
      value: fmt(p.name),
    },
    {
      studioKey: 'diameter',
      studioLabel: 'Diameter',
      toolRoomLabel: 'Cutting diameter (Dc)',
      value: fmt(p.diameter),
      unit: 'mm',
    },
    {
      studioKey: 'fluteCount',
      studioLabel: 'Flute count',
      toolRoomLabel: 'Number of flutes (Z)',
      value: fmt(p.fluteCount),
    },
    {
      studioKey: 'helixAngle',
      studioLabel: 'Helix angle',
      toolRoomLabel: 'Helix angle',
      value: fmt(p.helixAngle),
      unit: '°',
    },
    {
      studioKey: 'overallLength',
      studioLabel: 'Overall length',
      toolRoomLabel: 'Overall length (OAL / L)',
      value: fmt(p.overallLength),
      unit: 'mm',
    },
    {
      studioKey: 'fluteLength',
      studioLabel: 'Flute length',
      toolRoomLabel: 'Flute length (Lc)',
      value: fmt(p.fluteLength),
      unit: 'mm',
    },
    {
      studioKey: 'shankDiameter',
      studioLabel: 'Shank diameter',
      toolRoomLabel: 'Shank diameter (Ds)',
      value: fmt(p.shankDiameter),
      unit: 'mm',
    },
    {
      studioKey: 'shankLength',
      studioLabel: 'Shank length',
      toolRoomLabel: 'Shank length',
      value: fmt(p.shankLength),
      unit: 'mm',
    },
    {
      studioKey: 'cornerRadius',
      studioLabel: 'Corner radius',
      toolRoomLabel: 'Corner radius (Re) — 0 = square end',
      value: fmt(p.cornerRadius),
      unit: 'mm',
    },
    {
      studioKey: 'coating',
      studioLabel: 'Coating',
      toolRoomLabel: 'Coating',
      value: fmt(p.coating, '(none)'),
    },
    {
      studioKey: 'material',
      studioLabel: 'Material',
      toolRoomLabel: 'Blank / substrate material',
      value: fmt(p.material),
    },
  ]

  if (p.neckDiameter != null || p.neckLength != null) {
    rows.splice(
      9,
      0,
      {
        studioKey: 'neckDiameter',
        studioLabel: 'Neck diameter',
        toolRoomLabel: 'Neck diameter (reduced shank / neck)',
        value: fmt(p.neckDiameter),
        unit: 'mm',
      },
      {
        studioKey: 'neckLength',
        studioLabel: 'Neck length',
        toolRoomLabel: 'Neck length',
        value: fmt(p.neckLength),
        unit: 'mm',
      },
    )
  }

  return rows
}

const WEB_THINNING_LABEL: Record<WebThinningStyle, string> = {
  none: 'None',
  S: 'S-point',
  X: 'X-thinning',
  split: 'Split point',
  notched: 'Notched',
}

const GUN_FLUTE_LABEL: Record<GunFluteStyle, string> = {
  single: 'Single flute',
  v: 'V-flute',
}

interface DrillRowSpec {
  key: DrillFieldKey
  studioLabel: string
  toolRoomLabel: string
  unit?: string
}

const DRILL_ROW_SPECS: Partial<Record<DrillFieldKey, DrillRowSpec>> = {
  name: { key: 'name', studioLabel: 'Name', toolRoomLabel: 'Tool name / Description' },
  diameter: {
    key: 'diameter',
    studioLabel: 'Diameter',
    toolRoomLabel: 'Drill diameter (Dc)',
    unit: 'mm',
  },
  pointAngle: { key: 'pointAngle', studioLabel: 'Point angle', toolRoomLabel: 'Point angle', unit: '°' },
  fluteCount: { key: 'fluteCount', studioLabel: 'Flute count', toolRoomLabel: 'Number of flutes (Z)' },
  helixAngle: { key: 'helixAngle', studioLabel: 'Helix angle', toolRoomLabel: 'Helix angle', unit: '°' },
  overallLength: {
    key: 'overallLength',
    studioLabel: 'Overall length',
    toolRoomLabel: 'Overall length (OAL / L)',
    unit: 'mm',
  },
  fluteLength: {
    key: 'fluteLength',
    studioLabel: 'Flute length',
    toolRoomLabel: 'Flute length / body length',
    unit: 'mm',
  },
  shankDiameter: {
    key: 'shankDiameter',
    studioLabel: 'Shank diameter',
    toolRoomLabel: 'Shank diameter (Ds)',
    unit: 'mm',
  },
  shankLength: { key: 'shankLength', studioLabel: 'Shank length', toolRoomLabel: 'Shank length', unit: 'mm' },
  webThickness: { key: 'webThickness', studioLabel: 'Web thickness', toolRoomLabel: 'Web thickness', unit: 'mm' },
  marginWidth: { key: 'marginWidth', studioLabel: 'Margin width', toolRoomLabel: 'Margin width', unit: 'mm' },
  bodyClearance: {
    key: 'bodyClearance',
    studioLabel: 'Body clearance',
    toolRoomLabel: 'Body clearance (on diameter)',
    unit: 'mm',
  },
  lipReliefAngle: {
    key: 'lipReliefAngle',
    studioLabel: 'Lip relief',
    toolRoomLabel: 'Primary lip relief',
    unit: '°',
  },
  backTaper: {
    key: 'backTaper',
    studioLabel: 'Back taper',
    toolRoomLabel: 'Back taper',
    unit: 'mm/100 mm',
  },
  coolantHoles: { key: 'coolantHoles', studioLabel: 'Coolant holes', toolRoomLabel: 'Coolant hole count' },
  coolantHoleDiameter: {
    key: 'coolantHoleDiameter',
    studioLabel: 'Coolant hole diameter',
    toolRoomLabel: 'Coolant hole diameter',
    unit: 'mm',
  },
  sublandDiameter: {
    key: 'sublandDiameter',
    studioLabel: 'Subland diameter',
    toolRoomLabel: 'Subland / rear land diameter',
    unit: 'mm',
  },
  sublandLength: {
    key: 'sublandLength',
    studioLabel: 'Subland length',
    toolRoomLabel: 'Subland / rear land length',
    unit: 'mm',
  },
  countersinkAngle: {
    key: 'countersinkAngle',
    studioLabel: 'Countersink angle',
    toolRoomLabel: 'Countersink included angle',
    unit: '°',
  },
  countersinkDiameter: {
    key: 'countersinkDiameter',
    studioLabel: 'Countersink diameter',
    toolRoomLabel: 'Countersink diameter',
    unit: 'mm',
  },
  pilotLength: { key: 'pilotLength', studioLabel: 'Pilot length', toolRoomLabel: 'Pilot length', unit: 'mm' },
  chamferAngle: {
    key: 'chamferAngle',
    studioLabel: 'Chamfer angle',
    toolRoomLabel: 'Chamfer / countersink included angle',
    unit: '°',
  },
  chamferDiameter: {
    key: 'chamferDiameter',
    studioLabel: 'Chamfer diameter',
    toolRoomLabel: 'Chamfer diameter',
    unit: 'mm',
  },
}

function numericRow(spec: DrillRowSpec, value: number): HandoffFieldRow {
  return {
    studioKey: spec.key,
    studioLabel: spec.studioLabel,
    toolRoomLabel: spec.toolRoomLabel,
    value: fmt(value),
    unit: spec.unit,
    rawValue: value,
  }
}

export function buildDrillMapping(raw: DrillParams): HandoffFieldRow[] {
  const p = normalizeDrill(raw)
  const def = getDrillType(p.drillType)
  const rows: HandoffFieldRow[] = [
    {
      studioKey: 'drillType',
      studioLabel: 'Drill type',
      toolRoomLabel: 'Drill family (pick the matching iGrind drill type)',
      value: def.label,
      rawValue: p.drillType,
    },
  ]

  for (const key of def.fields) {
    if (key === 'steps') {
      p.steps.forEach((step, index) => {
        const n = index + 1
        rows.push(
          {
            studioKey: `step${n}Diameter`,
            studioLabel: `Step ${n} diameter`,
            toolRoomLabel: `Step ${n} diameter (tip is step 1)`,
            value: fmt(step.diameter),
            unit: 'mm',
            rawValue: step.diameter,
          },
          {
            studioKey: `step${n}Length`,
            studioLabel: `Step ${n} length`,
            toolRoomLabel: `Step ${n} length`,
            value: fmt(step.length),
            unit: 'mm',
            rawValue: step.length,
          },
        )
      })
      continue
    }
    if (key === 'centerSize') {
      rows.push({
        studioKey: 'centerSize',
        studioLabel: 'Center drill size',
        toolRoomLabel: 'Combined drill & countersink size (confirm diameters below)',
        value: p.centerSize,
        rawValue: p.centerSize,
      })
      continue
    }
    if (key === 'webThinning') {
      rows.push({
        studioKey: 'webThinning',
        studioLabel: 'Web thinning',
        toolRoomLabel: 'Web thinning style (set in iGrind point ops)',
        value: WEB_THINNING_LABEL[p.webThinning],
        rawValue: p.webThinning,
      })
      continue
    }
    if (key === 'webThinningNote') {
      rows.push({
        studioKey: 'webThinningNote',
        studioLabel: 'Web thinning note',
        toolRoomLabel: 'Web thinning note',
        value: fmt(p.webThinningNote, '(none)'),
        rawValue: p.webThinningNote,
      })
      continue
    }
    if (key === 'gunFluteStyle') {
      rows.push({
        studioKey: 'gunFluteStyle',
        studioLabel: 'Gun flute',
        toolRoomLabel: 'Gun drill flute (single-lip or V-flute)',
        value: GUN_FLUTE_LABEL[p.gunFluteStyle],
        rawValue: p.gunFluteStyle,
      })
      continue
    }
    if (key === 'coating') {
      rows.push({
        studioKey: 'coating',
        studioLabel: 'Coating',
        toolRoomLabel: 'Coating',
        value: fmt(p.coating, '(none)'),
        rawValue: p.coating,
      })
      continue
    }
    if (key === 'material') {
      rows.push({
        studioKey: 'material',
        studioLabel: 'Material',
        toolRoomLabel: 'Blank / substrate material',
        value: fmt(p.material),
        rawValue: p.material,
      })
      continue
    }
    if (key === 'name') {
      rows.push({
        studioKey: 'name',
        studioLabel: 'Name',
        toolRoomLabel: 'Tool name / Description',
        value: fmt(p.name),
        rawValue: p.name,
      })
      continue
    }
    if (key === 'coolantHoleDiameter' && p.coolantHoles <= 0) continue

    const spec = DRILL_ROW_SPECS[key]
    if (!spec) continue
    const raw = p[key]
    if (typeof raw !== 'number') continue
    rows.push(numericRow(spec, raw))
  }

  return rows
}

export function buildHandoffMapping(
  toolType: ToolType,
  params: EndmillParams | DrillParams,
): HandoffFieldRow[] {
  return toolType === 'endmill'
    ? buildEndmillMapping(params as EndmillParams)
    : buildDrillMapping(params as DrillParams)
}

export function buildHandoffPayload(
  toolType: ToolType,
  params: EndmillParams | DrillParams,
  designId: string | null = null,
): ToolRoomHandoffPayload {
  const mapping = buildHandoffMapping(toolType, params)
  const fields: Record<string, string | number | null> = { toolType }
  const bag = params as unknown as Record<string, unknown>
  for (const row of mapping) {
    if (row.rawValue !== undefined) {
      fields[row.studioKey] = row.rawValue
      continue
    }
    const raw = bag[row.studioKey]
    fields[row.studioKey] = typeof raw === 'string' || typeof raw === 'number' ? raw : null
  }

  return {
    schema: HANDOFF_SCHEMA,
    schemaVersion: HANDOFF_SCHEMA_VERSION,
    disclaimer: HANDOFF_DISCLAIMER,
    generatedAt: new Date().toISOString(),
    toolType,
    designId,
    fields,
    mapping,
    notes: [
      'Wizard field labels are typical iGrind / ToolRoom names and may differ by software generation (RN). Confirm against your ANCA docs or Club samples.',
      'Adapt ToolRoom scripting parameter IDs to your licensed release — this studio does not ship production-ready scripts for all RN versions.',
      'After creating the .TOM in ToolRoom, verify geometry in CIM3D before grinding on TGX.',
      'Confirm TGX software generation and post options with ANCA / your machine documentation.',
      ...(toolType === 'drill'
        ? [
            'drillType is the studio drill family (jobber, stub, step, gun, and so on). Step diameters are step1Diameter / step1Length. ToolRoom still creates the .TOM.',
          ]
        : []),
    ],
  }
}

export function buildHandoffPayloadFromDesign(design: SavedDesign): ToolRoomHandoffPayload {
  return buildHandoffPayload(design.toolType, design.params, design.id)
}

export function exportHandoffJson(payload: ToolRoomHandoffPayload) {
  const name =
    (typeof payload.fields.name === 'string' && payload.fields.name) ||
    payload.toolType ||
    'tool'
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 64) || 'handoff'
  downloadBlob(
    `${safe}-toolroom-handoff.json`,
    JSON.stringify(payload, null, 2),
    'application/json',
  )
}

export function displayValue(row: HandoffFieldRow): string {
  if (row.value === '—' || row.value === '(none)') return row.value
  return row.unit ? `${row.value} ${row.unit}` : row.value
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}
