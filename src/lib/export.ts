import { normalizeDrill } from './drillTypes'
import type { DrillParams, EndmillParams, JobTraveler, SavedDesign } from './types'

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
  const rows =
    design.toolType === 'drill'
      ? flattenDrill(design.params as DrillParams)
      : flattenEndmill(design.params as EndmillParams)
  const header = ['key', 'value']
  const lines = [
    '# ' + DISCLAIMER,
    header.join(','),
    ...rows.map(([k, v]) => `${csvEscape(k)},${csvEscape(String(v))}`),
  ]
  const name = (design.params as { name?: string }).name || 'tool'
  downloadBlob(`${sanitize(name)}.csv`, lines.join('\n'), 'text/csv')
}

function flattenEndmill(p: EndmillParams): [string, string | number][] {
  return [
    ['toolType', 'endmill'],
    ['name', p.name],
    ['diameter_mm', p.diameter],
    ['fluteCount', p.fluteCount],
    ['helixAngle_deg', p.helixAngle],
    ['overallLength_mm', p.overallLength],
    ['fluteLength_mm', p.fluteLength],
    ['shankDiameter_mm', p.shankDiameter],
    ['shankLength_mm', p.shankLength],
    ['coating', p.coating],
    ['material', p.material],
    ['cornerRadius_mm', p.cornerRadius],
    ['neckDiameter_mm', p.neckDiameter ?? ''],
    ['neckLength_mm', p.neckLength ?? ''],
  ]
}

function flattenDrill(raw: DrillParams): [string, string | number][] {
  const p = normalizeDrill(raw)
  const rows: [string, string | number][] = [
    ['toolType', 'drill'],
    ['drillType', p.drillType],
    ['name', p.name],
    ['diameter_mm', p.diameter],
    ['pointAngle_deg', p.pointAngle],
    ['fluteCount', p.fluteCount],
    ['helixAngle_deg', p.helixAngle],
    ['overallLength_mm', p.overallLength],
    ['fluteLength_mm', p.fluteLength],
    ['shankDiameter_mm', p.shankDiameter],
    ['shankLength_mm', p.shankLength],
    ['webThickness_mm', p.webThickness],
    ['webThinning', p.webThinning],
    ['webThinningNote', p.webThinningNote],
    ['marginWidth_mm', p.marginWidth],
    ['bodyClearance_mm', p.bodyClearance],
    ['lipReliefAngle_deg', p.lipReliefAngle],
    ['backTaper_mm_per_100mm', p.backTaper],
    ['coolantHoles', p.coolantHoles],
    ['coolantHoleDiameter_mm', p.coolantHoleDiameter],
    ['coating', p.coating],
    ['material', p.material],
  ]
  if (p.drillType === 'step') {
    p.steps.forEach((step, index) => {
      rows.push(
        [`step${index + 1}_diameter_mm`, step.diameter],
        [`step${index + 1}_length_mm`, step.length],
      )
    })
  }
  if (p.drillType === 'subland') {
    rows.push(['sublandDiameter_mm', p.sublandDiameter], ['sublandLength_mm', p.sublandLength])
  }
  if (p.drillType === 'center') {
    rows.push(
      ['centerSize', p.centerSize],
      ['pilotLength_mm', p.pilotLength],
      ['countersinkAngle_deg', p.countersinkAngle],
      ['countersinkDiameter_mm', p.countersinkDiameter],
    )
  }
  if (p.drillType === 'countersink') {
    rows.push(['chamferAngle_deg', p.chamferAngle], ['chamferDiameter_mm', p.chamferDiameter])
  }
  if (p.drillType === 'gun') rows.push(['gunFluteStyle', p.gunFluteStyle])
  return rows
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
