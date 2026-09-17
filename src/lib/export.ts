import type { DrillParams, EndmillParams, JobTraveler, SavedDesign, ToolType } from './types'

const DISCLAIMER =
  'For ToolRoom / TGX setup — not a TOM file. Human/machine-friendly parameters only; not proprietary ANCA binary.'

export function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function designToExportPayload(design: SavedDesign) {
  return {
    format: 'anca-tgx-studio-design-v1',
    disclaimer: DISCLAIMER,
    toolType: design.toolType,
    id: design.id,
    createdAt: design.createdAt,
    updatedAt: design.updatedAt,
    parameters: design.params,
  }
}

export function exportDesignJson(design: SavedDesign) {
  const payload = designToExportPayload(design)
  const name = (design.params as { name?: string }).name || 'tool'
  downloadBlob(
    `${sanitize(name)}.json`,
    JSON.stringify(payload, null, 2),
    'application/json',
  )
}

export function exportDesignCsv(design: SavedDesign) {
  const rows = flattenParams(design.toolType, design.params as EndmillParams & DrillParams)
  const header = ['key', 'value']
  const lines = [
    '# ' + DISCLAIMER,
    header.join(','),
    ...rows.map(([k, v]) => `${csvEscape(k)},${csvEscape(String(v))}`),
  ]
  const name = (design.params as { name?: string }).name || 'tool'
  downloadBlob(`${sanitize(name)}.csv`, lines.join('\n'), 'text/csv')
}

function flattenParams(
  type: ToolType,
  p: EndmillParams & Partial<DrillParams>,
): [string, string | number][] {
  const base: [string, string | number][] = [
    ['toolType', type],
    ['name', p.name],
    ['diameter_mm', p.diameter],
    ['fluteCount', p.fluteCount],
    ['overallLength_mm', p.overallLength],
    ['fluteLength_mm', p.fluteLength],
    ['shankDiameter_mm', p.shankDiameter],
    ['shankLength_mm', p.shankLength],
    ['coating', p.coating],
    ['material', p.material],
  ]
  if (type === 'endmill') {
    base.splice(4, 0, ['helixAngle_deg', p.helixAngle])
    base.push(
      ['cornerRadius_mm', p.cornerRadius],
      ['neckDiameter_mm', p.neckDiameter ?? ''],
      ['neckLength_mm', p.neckLength ?? ''],
    )
  } else {
    base.splice(4, 0, ['pointAngle_deg', p.pointAngle ?? ''])
    base.push(['webThinningNote', p.webThinningNote ?? ''])
  }
  return base
}

export function exportTravelerJson(traveler: JobTraveler) {
  const payload = {
    format: 'anca-tgx-studio-traveler-v1',
    disclaimer: DISCLAIMER,
    traveler,
  }
  const name = traveler.jobNumber || traveler.designName || 'traveler'
  downloadBlob(
    `${sanitize(name)}-traveler.json`,
    JSON.stringify(payload, null, 2),
    'application/json',
  )
}

function sanitize(s: string) {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 64) || 'export'
}

function csvEscape(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export { DISCLAIMER }
