import { describe, expect, it } from 'vitest'
import { snapshotFromDesign } from './designSnapshot'
import {
  CENTER_DRILL_SPECS,
  applyCenterDrillSize,
  createDrill,
  drillCaption,
  normalizeDrill,
} from './drillTypes'
import { buildDrillMapping, buildHandoffPayload } from './toolroomHandoff'
import { DEFAULT_ENDMILL, type DrillParams, type SavedDesign } from './types'
import { DRILL_TYPE_IDS } from './types'
import { validateDrill, validateEndmill } from './validation'

describe('drill library', () => {
  it('accepts every library default', () => {
    for (const id of DRILL_TYPE_IDS) {
      const drill = createDrill(id)
      expect(drill.drillType).toBe(id)
      expect(validateDrill(drill), `${id}: ${JSON.stringify(validateDrill(drill))}`).toEqual({})
      expect(drillCaption(drill)).toContain(drill.diameter.toString())
    }
  })

  it('accepts every center-drill size', () => {
    for (const spec of CENTER_DRILL_SPECS) {
      const drill = applyCenterDrillSize(createDrill('center'), spec.size)
      expect(drill.centerSize).toBe(spec.size)
      expect(drill.diameter).toBe(spec.pilot)
      expect(drill.countersinkDiameter).toBe(spec.body)
      expect(drill.countersinkDiameter).toBeGreaterThan(drill.diameter)
      expect(validateDrill(drill), `${spec.size}: ${JSON.stringify(validateDrill(drill))}`).toEqual({})
    }
  })

  it('keeps a pre-library drill as a jobber and scales the web', () => {
    const legacy = {
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
      material: 'carbide' as const,
    }
    const drill = normalizeDrill(legacy)
    expect(drill.drillType).toBe('jobber')
    expect(drill.diameter).toBe(8)
    expect(drill.fluteLength).toBe(45)
    expect(drill.overallLength).toBe(80)
    expect(drill.webThinningNote).toBe('')
    expect(validateDrill(drill)).toEqual({})

    const small = normalizeDrill({ ...legacy, diameter: 3, fluteLength: 20, shankLength: 25, overallLength: 50 })
    expect(small.webThickness).toBeLessThan(1.2)
    expect(validateDrill(small)).toEqual({})
  })

  it('copies step arrays so edits do not change the library default', () => {
    const first = createDrill('step')
    first.steps[0].diameter = 99
    expect(createDrill('step').steps[0].diameter).toBe(6)
  })

  it('still accepts the default endmill', () => {
    expect(validateEndmill(DEFAULT_ENDMILL)).toEqual({})
  })
})

describe('drill geometry validation', () => {
  function broken(id: DrillParams['drillType'], patch: Partial<DrillParams>): DrillParams {
    return { ...createDrill(id), ...patch }
  }

  it('rejects a flute that is longer than the tool', () => {
    const errors = validateDrill(broken('jobber', { fluteLength: 117, overallLength: 117 }))
    expect(errors.fluteLength).toMatch(/shorter than the overall length/i)
  })

  it('rejects a flute plus shank that overruns the overall length', () => {
    const errors = validateDrill(broken('stub', { fluteLength: 50, shankLength: 40, overallLength: 79 }))
    expect(errors.fluteLength).toMatch(/longer than the overall length/i)
  })

  it('rejects a web that does not fit the diameter', () => {
    const errors = validateDrill(broken('jobber', { webThickness: 7 }))
    expect(errors.webThickness).toMatch(/5–45%/)
  })

  it('rejects a point that is longer than the flute', () => {
    const errors = validateDrill(broken('jobber', { diameter: 20, pointAngle: 60, fluteLength: 8, overallLength: 80, shankLength: 40 }))
    expect(errors.pointAngle).toMatch(/longer than the flute/i)
  })

  it('rejects step diameters that do not grow from the tip', () => {
    const drill = broken('step', {})
    drill.steps = [
      { diameter: 10, length: 12 },
      { diameter: 8, length: 10 },
    ]
    drill.diameter = 10
    drill.fluteLength = 22
    const errors = validateDrill(drill)
    expect(errors['step-1-diameter']).toMatch(/larger than step 1/i)
  })

  it('rejects step lengths that do not fit in the overall length', () => {
    const drill = createDrill('step')
    drill.steps = drill.steps.map((step) => ({ ...step, length: 40 }))
    drill.fluteLength = 120
    drill.overallLength = 100
    const errors = validateDrill(drill)
    expect(errors.steps).toMatch(/shorter than the overall length/i)
  })

  it('rejects a subland that is not larger than the front diameter', () => {
    const errors = validateDrill(broken('subland', { sublandDiameter: 8, diameter: 8 }))
    expect(errors.sublandDiameter).toMatch(/larger than the front diameter/i)
  })

  it('rejects a center drill whose pilot is not smaller than the countersink', () => {
    const errors = validateDrill(broken('center', { diameter: 8, countersinkDiameter: 6 }))
    expect(errors.countersinkDiameter).toMatch(/larger than the pilot/i)
  })

  it('rejects a chamfer that is not larger than the drill', () => {
    const errors = validateDrill(broken('countersink', { chamferDiameter: 6, diameter: 6 }))
    expect(errors.chamferDiameter).toMatch(/larger than the drill diameter/i)
  })

  it('rejects coolant holes that do not fit in the web', () => {
    const errors = validateDrill(broken('coolant', { coolantHoles: 2, coolantHoleDiameter: 3, webThickness: 2 }))
    expect(errors.coolantHoleDiameter).toMatch(/smaller than the web/i)
  })

  it('rejects a micro drill above 3 mm', () => {
    const errors = validateDrill(broken('micro', { diameter: 10 }))
    expect(errors.diameter).toMatch(/0\.05–3/)
  })

  it('rejects a twisted gun drill', () => {
    const errors = validateDrill(broken('gun', { helixAngle: 30 }))
    expect(errors.helixAngle).toMatch(/straight-flute/i)
  })

  it('rejects a 90° spot drill with a 140° point', () => {
    const errors = validateDrill(broken('spot90', { pointAngle: 140 }))
    expect(errors.pointAngle).toMatch(/80–100/)
  })
})

describe('drill handoff and traveler snapshot', () => {
  it('puts the drill family and step diameters on the ToolRoom handoff', () => {
    const step = createDrill('step')
    const rows = buildDrillMapping(step)
    const type = rows.find((row) => row.studioKey === 'drillType')
    expect(type?.rawValue).toBe('step')
    expect(type?.value).toMatch(/step/i)
    expect(rows.find((row) => row.studioKey === 'step1Diameter')?.rawValue).toBe(6)
    expect(rows.find((row) => row.studioKey === 'step2Diameter')?.rawValue).toBe(10)
    expect(rows.find((row) => row.studioKey === 'step3Diameter')?.rawValue).toBe(14)
    expect(rows.find((row) => row.studioKey === 'sublandDiameter')).toBeUndefined()

    const payload = buildHandoffPayload('drill', step, 'des_1')
    expect(payload.fields.drillType).toBe('step')
    expect(payload.fields.step1Diameter).toBe(6)
    expect(payload.schema).toBe('toolroomHandoff')
  })

  it('keeps the endmill handoff free of drill fields', () => {
    const payload = buildHandoffPayload('endmill', DEFAULT_ENDMILL, null)
    expect(payload.fields.toolType).toBe('endmill')
    expect(payload.fields.drillType).toBeUndefined()
    expect(payload.fields.diameter).toBe(DEFAULT_ENDMILL.diameter)
  })

  it('copies drill parameters onto a traveler snapshot', () => {
    const drill = createDrill('gun')
    const design: SavedDesign = {
      id: 'des_gun',
      toolType: 'drill',
      params: drill,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    }
    const snapshot = snapshotFromDesign(design)
    expect(snapshot.drillType).toBe('gun')
    expect(snapshot.drillTypeLabel).toMatch(/gun/i)
    expect(snapshot.lines.some((line) => line.label === 'Drill type' && /gun/i.test(line.value))).toBe(true)
    expect(snapshot.lines.some((line) => line.label === 'Coolant holes')).toBe(true)
  })
})
