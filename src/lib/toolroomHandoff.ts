import type {
  DrillParams,
  EndmillParams,
  SavedDesign,
  ToolType,
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

export function buildDrillMapping(p: DrillParams): HandoffFieldRow[] {
  return [
    {
      studioKey: 'name',
      studioLabel: 'Name',
      toolRoomLabel: 'Tool name / Description',
      value: fmt(p.name),
    },
    {
      studioKey: 'diameter',
      studioLabel: 'Diameter',
      toolRoomLabel: 'Drill diameter (Dc)',
      value: fmt(p.diameter),
      unit: 'mm',
    },
    {
      studioKey: 'pointAngle',
      studioLabel: 'Point angle',
      toolRoomLabel: 'Point angle',
      value: fmt(p.pointAngle),
      unit: '°',
    },
    {
      studioKey: 'fluteCount',
      studioLabel: 'Flute count',
      toolRoomLabel: 'Number of flutes (Z)',
      value: fmt(p.fluteCount),
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
      toolRoomLabel: 'Flute length / body length',
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
    {
      studioKey: 'webThinningNote',
      studioLabel: 'Web thinning note',
      toolRoomLabel: 'Web thinning / point thinning (manual note — set in iGrind point ops)',
      value: fmt(p.webThinningNote, '(none)'),
    },
  ]
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
  const bag = params as unknown as Record<string, string | number | null | undefined>
  for (const row of mapping) {
    const raw = bag[row.studioKey]
    fields[row.studioKey] = raw === undefined ? null : raw
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
