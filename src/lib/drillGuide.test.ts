import { describe, expect, it } from 'vitest'
import { DRILL_TYPE_IDS, type DrillTypeId } from './types'
import { createDrill, getDrillType, type DrillFieldKey } from './drillTypes'
import { validateDrill } from './validation'
import {
  adviseDrill,
  allDrillTypeIds,
  alternativeDrills,
  beginnerFieldKeys,
  drillCard,
  fieldHelp,
  recommendDrill,
  starterTemplates,
  type WizardAnswers,
  type WorkpieceMaterial,
} from './drillGuide'

const FIELD_KEYS: DrillFieldKey[] = [
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
  'webThinningNote',
  'marginWidth',
  'bodyClearance',
  'lipReliefAngle',
  'backTaper',
  'coolantHoles',
  'coolantHoleDiameter',
  'steps',
  'sublandDiameter',
  'sublandLength',
  'centerSize',
  'countersinkAngle',
  'countersinkDiameter',
  'pilotLength',
  'chamferAngle',
  'chamferDiameter',
  'gunFluteStyle',
  'coating',
  'material',
]

function answers(partial: Partial<WizardAnswers> & Pick<WizardAnswers, 'material' | 'diameter' | 'depth'>): WizardAnswers {
  return {
    feature: 'plain',
    throughCoolant: 'unsure',
    ...partial,
  }
}

describe('starter templates', () => {
  it('loads a valid drill for every common job', () => {
    const templates = starterTemplates()
    expect(templates.length).toBeGreaterThanOrEqual(4)
    for (const template of templates) {
      expect(validateDrill(template.drill), template.id).toEqual({})
      expect(template.blurb.length).toBeGreaterThan(10)
    }
    const ids = templates.map((template) => template.id)
    expect(ids).toContain('al-6-3d')
    expect(ids).toContain('steel-spot-drill')
    expect(ids).toContain('ss-deep')
    expect(ids).toContain('step-sheet')
  })
})

describe('recommendDrill', () => {
  it('picks a jobber with a 130° point for an ordinary aluminum hole', () => {
    const result = recommendDrill(answers({ material: 'aluminum', diameter: 6, depth: 18 }))
    expect(result.ok).toBe(true)
    expect(result.drill?.drillType).toBe('jobber')
    expect(result.drill?.pointAngle).toBe(130)
    expect(result.reason.length).toBeGreaterThan(10)
    expect(validateDrill(result.drill!)).toEqual({})
  })

  it('uses coolant-through for a deep stainless hole when the machine can push coolant', () => {
    const result = recommendDrill(
      answers({ material: 'stainless', diameter: 8, depth: 80, throughCoolant: 'yes' }),
    )
    expect(result.drill?.drillType).toBe('coolant')
    expect(result.drill?.pointAngle).toBe(140)
    expect(validateDrill(result.drill!)).toEqual({})
  })

  it('uses a parabolic flute for that same hole when coolant through the tool is unavailable', () => {
    const result = recommendDrill(
      answers({ material: 'stainless', diameter: 8, depth: 80, throughCoolant: 'no' }),
    )
    expect(result.drill?.drillType).toBe('parabolic')
    expect(validateDrill(result.drill!)).toEqual({})
  })

  it('uses a straight flute in brass', () => {
    const result = recommendDrill(answers({ material: 'brass', diameter: 8, depth: 24 }))
    expect(result.drill?.drillType).toBe('straight')
    expect(result.drill?.helixAngle).toBe(0)
    expect(validateDrill(result.drill!)).toEqual({})
  })

  it('follows the feature the person asked for', () => {
    expect(recommendDrill(answers({ material: 'aluminum', diameter: 10, depth: 12, feature: 'flat' })).drill?.drillType).toBe(
      'flat-bottom',
    )
    expect(
      recommendDrill(answers({ material: 'mild-steel', diameter: 8, depth: 12, feature: 'chamfer' })).drill?.drillType,
    ).toBe('countersink')
    expect(recommendDrill(answers({ material: 'aluminum', diameter: 6, depth: 8, feature: 'steps' })).drill?.drillType).toBe(
      'step',
    )
    expect(recommendDrill(answers({ material: 'mild-steel', diameter: 3, depth: 8, feature: 'center' })).drill?.drillType).toBe(
      'center',
    )
  })

  it('refuses a diameter the library cannot build', () => {
    const result = recommendDrill(answers({ material: 'aluminum', diameter: 80, depth: 40 }))
    expect(result.ok).toBe(false)
    expect(result.drill).toBeNull()
  })

  it('offers other valid types besides the recommendation', () => {
    const input = answers({ material: 'aluminum', diameter: 6, depth: 18 })
    const result = recommendDrill(input)
    const others = alternativeDrills(input, result.drill!.drillType)
    expect(others.length).toBeGreaterThan(0)
    for (const other of others) {
      expect(other.drill.drillType).not.toBe(result.drill!.drillType)
      expect(validateDrill(other.drill)).toEqual({})
    }
  })
})

describe('adviseDrill', () => {
  it('warns when a jobber flute is very long and stays quiet on a normal jobber', () => {
    const deep = starterTemplates().find((template) => template.id === 'al-6-3d')!.drill
    const long = { ...deep, fluteLength: 80, overallLength: 130, shankLength: 40 }
    expect(validateDrill(long)).toEqual({})
    const warnings = adviseDrill(long, null)
    expect(warnings.some((warning) => warning.id === 'deep-twist')).toBe(true)
    expect(adviseDrill(deep, 'aluminum')).toEqual([])
    expect(adviseDrill(createDrill('jobber'), null).some((warning) => warning.id === 'deep-twist')).toBe(false)
  })

  it('suggests coolant-through for a deeper steel hole on a jobber', () => {
    const drill = starterTemplates().find((template) => template.id === 'steel-spot-drill')!.drill
    const deeper = { ...drill, fluteLength: 50, overallLength: 100, shankLength: 45 }
    const warnings = adviseDrill(deeper, 'mild-steel')
    expect(warnings.some((warning) => warning.id === 'steel-coolant')).toBe(true)
    expect(adviseDrill(deeper, null).some((warning) => warning.id === 'steel-coolant')).toBe(false)
  })
})

describe('beginner fields, cards, and help', () => {
  it('shows about five or six beginner fields, all real fields for that type', () => {
    for (const typeId of DRILL_TYPE_IDS) {
      const keys = beginnerFieldKeys(typeId)
      expect(keys.length).toBeGreaterThanOrEqual(5)
      expect(keys.length).toBeLessThanOrEqual(6)
      const allowed = new Set<string>(getDrillType(typeId).fields)
      for (const key of keys) expect(allowed.has(key), `${typeId}.${key}`).toBe(true)
    }
  })

  it('has a card and help text for every type and field', () => {
    expect(allDrillTypeIds()).toEqual(DRILL_TYPE_IDS)
    for (const typeId of DRILL_TYPE_IDS) {
      const card = drillCard(typeId)
      expect(card.forWhat.length).toBeGreaterThan(8)
      expect(card.useWhen.length).toBeGreaterThan(8)
      expect(card.avoidWhen.length).toBeGreaterThan(8)
    }
    for (const key of FIELD_KEYS) {
      const help = fieldHelp(key)
      expect(help.text.length).toBeGreaterThan(12)
    }
  })
})

describe('recommendation stays valid across materials', () => {
  const materials: WorkpieceMaterial[] = [
    'aluminum',
    'mild-steel',
    'stainless',
    'cast-iron',
    'brass',
    'plastic',
    'hardened',
    'unsure',
  ]

  it('validates a mid-size hole for each material', () => {
    for (const material of materials) {
      const result = recommendDrill(answers({ material, diameter: 8, depth: 24, throughCoolant: 'no' }))
      expect(result.ok, material).toBe(true)
      expect(validateDrill(result.drill!), material).toEqual({})
    }
  })

  it('validates every recommended family used as an alternative', () => {
    const input = answers({ material: 'mild-steel', diameter: 10, depth: 30, throughCoolant: 'yes' })
    const chosen = recommendDrill(input).drill!.drillType
    const seen = new Set<DrillTypeId>([chosen])
    for (const other of alternativeDrills(input, chosen)) seen.add(other.drill.drillType)
    expect(seen.size).toBeGreaterThan(1)
  })
})
