import { describe, expect, it } from 'vitest'
import { createDrill } from './drillTypes'
import { grindOps } from './grindOps'
import { buildGrindPlan } from './grindPlan'
import { DEFAULT_ENDMILL, DRILL_TYPE_IDS } from './types'
import { buildHandoffPayload } from './toolroomHandoff'
import {
  CATALOG_PACKS,
  clonePack,
  parseWheelCatalog,
  recommendPack,
  serializeWheelCatalog,
  validatePack,
  type WheelPack,
} from './wheelPacks'

function stages(drillId: (typeof DRILL_TYPE_IDS)[number], mode: 'make' | 'resharpen' = 'make') {
  return grindOps(createDrill(drillId), mode, 0.5).operations.map((op) => op.stage)
}

describe('grind operations', () => {
  it('builds a make sequence and a resharpen sequence for every drill type', () => {
    for (const id of DRILL_TYPE_IDS) {
      const drill = createDrill(id)
      const made = grindOps(drill, 'make', 0.5)
      expect(made.operations.length).toBeGreaterThanOrEqual(3)
      expect(made.operations[0]?.duty).toBe('inspect')
      expect(made.operations.some((op) => op.stage === 'point' || op.stage === 'face')).toBe(true)
      expect(made.operations.some((op) => op.stage === 'flute')).toBe(true)

      const worn = grindOps(drill, 'resharpen', 0.5)
      expect(worn.operations.some((op) => op.duty === 'flute')).toBe(false)
      expect(worn.operations.some((op) => op.stage === 'length')).toBe(true)
      expect(worn.operations.some((op) => op.stage === 'point' || op.stage === 'face')).toBe(true)
      expect(worn.operations[0]?.stage).toBe('wear')
      expect(worn.stockRemovedMm).toBe(0.5)
    }
  })

  it('gashes a split-point jobber and skips gashing on a spot drill', () => {
    expect(stages('jobber')).toContain('gash')
    expect(stages('spot90')).not.toContain('gash')
    const spot = createDrill('spot90')
    spot.webThinning = 'split'
    expect(grindOps(spot, 'make', 0.5).operations.some((op) => op.stage === 'gash')).toBe(true)
    expect(grindOps(createDrill('jobber'), 'resharpen', 0.5).operations.some((op) => op.stage === 'gash')).toBe(
      true,
    )
    expect(grindOps(createDrill('spot90'), 'resharpen', 0.5).operations.some((op) => op.stage === 'gash')).toBe(
      false,
    )
    expect(grindOps(createDrill('gun'), 'resharpen', 0.5).operations.some((op) => op.stage === 'gash')).toBe(false)
  })

  it('includes shoulders, chamfers, and a non-grind coolant check', () => {
    expect(stages('step')).toContain('step')
    expect(stages('countersink')).toContain('chamfer')
    expect(stages('center')).toContain('chamfer')
    const coolant = grindOps(createDrill('coolant'), 'make', 0.5).operations.find((op) => op.stage === 'coolant')
    expect(coolant?.duty).toBe('blank-feature')
    expect(coolant?.narration.toLowerCase()).toContain('does not cut')
  })

  it('puts the removed length into the resharpen narration', () => {
    const length = grindOps(createDrill('jobber'), 'resharpen', 0.8).operations.find((op) => op.stage === 'length')
    expect(length?.narration).toContain('0.8')
    expect(length?.narration.toLowerCase()).toContain('demonstration')
  })
})

describe('wheel packs', () => {
  it('recommends a pack from material, family, and diameter', () => {
    const jobber = createDrill('jobber')
    const twist = recommendPack(jobber)
    expect(twist.pack.id).toBe('twist-carbide')
    expect(twist.reason.length).toBeGreaterThan(10)

    const hss = recommendPack({ ...jobber, material: 'HSS' })
    expect(hss.pack.id).toBe('hss-resharpen')
    expect(hss.reason.toLowerCase()).toContain('cbn')

    expect(recommendPack(createDrill('gun')).pack.id).toBe('gun-carbide')
    expect(recommendPack(createDrill('step')).pack.id).toBe('step-carbide')
    expect(recommendPack(createDrill('countersink')).pack.id).toBe('step-carbide')
    expect(recommendPack(createDrill('micro')).pack.id).toBe('micro-carbide')
    expect(recommendPack({ ...jobber, diameter: 2 }).pack.id).toBe('micro-carbide')
  })

  it('warns when the pack cannot gash, and assigns wheels when it can', () => {
    const jobber = createDrill('jobber')
    const good = buildGrindPlan(jobber, 'make', recommendPack(jobber).pack, 0.5)
    expect(good.warnings).toEqual([])
    const gash = good.operations.find((op) => op.stage === 'gash')
    expect(gash?.wheelName).toBeTruthy()
    expect(gash?.wheelShape).toBe('1V1')

    const broken: WheelPack = clonePack(recommendPack(jobber).pack)
    broken.wheels = broken.wheels.map((wheel) => ({
      ...wheel,
      duties: wheel.duties.filter((duty) => duty !== 'gash'),
    }))
    const plan = buildGrindPlan(jobber, 'make', broken, 0.5)
    expect(plan.warnings.some((warning) => warning.toLowerCase().includes('gashing'))).toBe(true)
    expect(plan.operations.find((op) => op.stage === 'gash')?.wheelName).toBeNull()
  })

  it('round-trips the sample catalog and rejects a bad file', () => {
    const parsed = parseWheelCatalog(serializeWheelCatalog(CATALOG_PACKS))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.packs.map((pack) => pack.id)).toEqual(CATALOG_PACKS.map((pack) => pack.id))
      expect(parsed.packs[0]?.wheels[0]?.duties.length).toBeGreaterThan(0)
    }

    expect(parseWheelCatalog('not json').ok).toBe(false)
    expect(parseWheelCatalog('{"schema":"other"}').ok).toBe(false)

    const zeroDiameter = parseWheelCatalog(
      JSON.stringify({
        schema: 'tgxStudioWheelCatalog',
        schemaVersion: 1,
        packs: [
          {
            id: 'shop',
            name: 'Shop',
            wheels: [
              {
                id: 'w',
                name: 'Wheel',
                shape: '1A1',
                diameterMm: 0,
                widthMm: 10,
                abrasive: 'diamond',
                grit: 'medium',
                duties: ['od'],
              },
            ],
          },
        ],
      }),
    )
    expect(zeroDiameter.ok).toBe(false)
    if (!zeroDiameter.ok) expect(zeroDiameter.error.toLowerCase()).toContain('diameter')

    const badShape = parseWheelCatalog(
      JSON.stringify({
        schema: 'tgxStudioWheelCatalog',
        schemaVersion: 1,
        packs: [
          {
            id: 'shop',
            name: 'Shop',
            wheels: [
              {
                id: 'w',
                name: 'Wheel',
                shape: '11A2',
                diameterMm: 100,
                widthMm: 10,
                abrasive: 'diamond',
                grit: 'medium',
                duties: ['od'],
              },
            ],
          },
        ],
      }),
    )
    expect(badShape.ok).toBe(false)
  })

  it('accepts a custom pack that covers every required job', () => {
    const custom: WheelPack = {
      id: 'shop-1',
      name: 'Shelf A',
      notes: '',
      source: 'custom',
      wheels: [
        {
          id: 'a',
          name: 'Straight',
          shape: '1A1',
          diameterMm: 100,
          widthMm: 10,
          abrasive: 'diamond',
          grit: 'medium',
          duties: ['od', 'flute', 'clearance'],
        },
        {
          id: 'b',
          name: 'Flared',
          shape: '1V1',
          diameterMm: 100,
          widthMm: 6,
          abrasive: 'diamond',
          grit: 'fine',
          duties: ['gash'],
        },
        {
          id: 'c',
          name: 'Cup',
          shape: '11V9',
          diameterMm: 100,
          widthMm: 3,
          abrasive: 'diamond',
          grit: 'fine',
          duties: ['point'],
        },
      ],
    }
    expect(validatePack(custom)).toBeNull()
    const plan = buildGrindPlan(createDrill('jobber'), 'make', custom, 0.5)
    expect(plan.warnings).toEqual([])
    for (const op of plan.operations) {
      if (op.duty === 'inspect' || op.duty === 'blank-feature') expect(op.wheelName).toBeNull()
      else expect(op.wheelName).toBeTruthy()
    }
  })
})

describe('handoff grind plan', () => {
  it('leaves the payload unchanged unless a drill plan is passed', () => {
    const plain = buildHandoffPayload('drill', createDrill('jobber'), null)
    expect(plain.grindPlan).toBeUndefined()
    expect(plain.schemaVersion).toBe(1)

    const step = createDrill('step')
    const plan = buildGrindPlan(step, 'make', recommendPack(step).pack, 0.5)
    const withPlan = buildHandoffPayload('drill', step, 'design-1', plan)
    expect(withPlan.grindPlan?.pack.id).toBe('step-carbide')
    expect(withPlan.grindPlan?.mode).toBe('make')
    expect(withPlan.grindPlan?.operations.some((op) => op.forms.toLowerCase().includes('shoulder'))).toBe(true)
    expect(withPlan.grindPlan?.disclaimer.toLowerCase()).toContain('not anca')
    expect(withPlan.notes.some((note) => note.toLowerCase().includes('educational'))).toBe(true)

    const endmill = buildHandoffPayload('endmill', DEFAULT_ENDMILL, null, plan)
    expect(endmill.grindPlan).toBeUndefined()
    expect(endmill.toolType).toBe('endmill')
  })
})
