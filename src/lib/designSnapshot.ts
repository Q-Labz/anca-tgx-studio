import { getDrillType, normalizeDrill } from './drillTypes'
import { buildHandoffMapping, displayValue } from './toolroomHandoff'
import type { DesignSnapshot, DrillParams, SavedDesign } from './types'

/** Parameter lines copied onto a traveler and the setup sheet. */
export function snapshotFromDesign(design: SavedDesign): DesignSnapshot {
  const drill = design.toolType === 'drill' ? normalizeDrill(design.params) : null
  const params = drill ?? design.params
  const mapping = buildHandoffMapping(design.toolType, params)
  return {
    toolType: design.toolType,
    drillType: drill?.drillType ?? null,
    drillTypeLabel: drill ? getDrillType(drill.drillType).label : null,
    lines: mapping.map((row) => ({ label: row.studioLabel, value: displayValue(row) })),
  }
}

export function drillParamsOf(design: SavedDesign): DrillParams | null {
  if (design.toolType !== 'drill') return null
  return normalizeDrill(design.params)
}
