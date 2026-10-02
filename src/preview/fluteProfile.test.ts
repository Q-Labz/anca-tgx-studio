import { describe, expect, it } from 'vitest'
import { createDrill } from '../lib/drillTypes'
import { pointConeHeight } from '../lib/drillMath'
import { DRILL_TYPE_IDS } from '../lib/types'
import {
  FINISHED_REVEAL,
  fluteOpenAt,
  helixTwistRadians,
  marginFraction,
  planDrill,
  pointNotch,
  stationRadius,
} from './fluteProfile'

describe('helical flute profile', () => {
  it('turns a 30° jobber helix from the real lead, and leaves a straight flute alone', () => {
    const twist = helixTwistRadians(30, 75, 8)
    expect(twist).toBeCloseTo((2 * 75 * Math.tan(Math.PI / 6)) / 8, 5)
    expect(twist).toBeLessThan(Math.PI * 4)
    expect(helixTwistRadians(0, 250, 8)).toBe(0)
  })

  it('keeps the margin on the cutting diameter and the gullet down at the web', () => {
    const outer = 4
    const web = 0.6
    expect(stationRadius(0, 2, outer, web, 0.08, 1, 'twist', 0.08)).toBeCloseTo(outer, 5)
    let min = outer
    for (let step = 0; step < 64; step++) {
      const radius = stationRadius((step / 64) * Math.PI, 2, outer, web, 0.08, 1, 'twist', 0.08)
      min = Math.min(min, radius)
      expect(radius).toBeLessThanOrEqual(outer + 1e-6)
      expect(radius).toBeGreaterThanOrEqual(web - 1e-6)
    }
    expect(min).toBeLessThan(outer * 0.55)
    expect(stationRadius(1.2, 2, outer, web, 0.08, 0, 'twist', 0.2)).toBeCloseTo(outer, 5)

    let nearOd = 0
    const samples = 96
    for (let step = 0; step < samples; step++) {
      const radius = stationRadius((step / samples) * Math.PI * 2, 2, outer, web, 0.08, 1, 'twist', 0.05)
      if (radius > outer * 0.9) nearOd += 1
    }
    expect(nearOd).toBeGreaterThan(samples * 0.5)
  })

  it('gives a gun drill one deep straight flute and a double margin two lands', () => {
    const outer = 4
    let nearOd = 0
    let deep = 0
    for (let step = 0; step < 72; step++) {
      const radius = stationRadius((step / 72) * Math.PI * 2, 1, outer, 1.8, 0.08, 1, 'gun', 0.05)
      if (radius > outer * 0.97) nearOd += 1
      if (radius < outer * 0.7) deep += 1
    }
    expect(nearOd).toBeGreaterThan(18)
    expect(deep).toBeGreaterThan(8)

    const lands = [0.02, 0.25].map((u) => stationRadius(u * Math.PI, 2, outer, 0.7, 0.08, 1, 'double', 0.05))
    expect(lands[0]).toBeCloseTo(outer, 4)
    expect(lands[1]).toBeGreaterThan(outer * 0.95)
  })

  it('holds the chisel closed and opens the flute along the cone', () => {
    expect(fluteOpenAt(0, 2.4, 40, 1)).toBeLessThan(0.05)
    expect(fluteOpenAt(2.4, 2.4, 40, 1)).toBeGreaterThan(0.95)
    expect(fluteOpenAt(10, 2.4, 40, 0)).toBe(0)
    expect(pointNotch(0.1 * Math.PI, 2, 'none', 0.1, 2)).toBe(1)
    expect(pointNotch(0.1 * Math.PI, 2, 'split', 0.05, 2)).toBeLessThan(0.9)
  })

  it('plans every library drill as a contiguous point, body, and chamfered shank', () => {
    for (const id of DRILL_TYPE_IDS) {
      const plan = planDrill(createDrill(id), 1, FINISHED_REVEAL)
      expect(plan.spans.length, id).toBeGreaterThan(2)
      expect(plan.spans[0].z0, id).toBe(0)
      expect(plan.spans.some((span) => span.kind === 'shank'), id).toBe(true)
      for (let index = 0; index < plan.spans.length; index++) {
        const span = plan.spans[index]
        expect(span.z1, id).toBeGreaterThan(span.z0)
        expect(span.r0, id).toBeGreaterThan(0)
        expect(span.r1, id).toBeGreaterThan(0)
        if (index > 0) expect(span.z0, id).toBeCloseTo(plan.spans[index - 1].z1, 5)
      }
      const last = plan.spans[plan.spans.length - 1]
      expect(last.kind, id).toBe('shank')
      expect(last.r1, id).toBeLessThan(last.r0 * 0.9)
    }
  })

  it('uses the real point angle, helix, and step diameters', () => {
    const jobber = createDrill('jobber')
    const plan = planDrill(jobber, 1, FINISHED_REVEAL)
    expect(plan.coneH).toBeCloseTo(pointConeHeight(jobber.diameter, jobber.pointAngle), 2)
    expect(plan.helixTwist).toBeCloseTo(helixTwistRadians(30, 75, 8), 4)
    expect(plan.fluteCount).toBe(2)
    expect(plan.notch).toBe('split')
    expect(plan.coolant).toBeNull()

    const step = planDrill(createDrill('step'), 1, FINISHED_REVEAL)
    const radii = step.spans.filter((span) => span.kind === 'cutting' && !span.blend).map((span) => span.r1)
    expect(radii).toEqual([3, 5, 7])

    const gun = planDrill(createDrill('gun'), 1, FINISHED_REVEAL)
    expect(gun.fluteCount).toBe(1)
    expect(gun.family).toBe('gun')
    expect(gun.helixTwist).toBe(0)
    expect(gun.coolant?.axial).toBe(true)
    expect(gun.driverStart).not.toBeNull()

    const spot = planDrill(createDrill('spot90'), 1, FINISHED_REVEAL)
    expect(spot.coneH).toBeGreaterThan(4)
    expect(marginFraction(0.6, 8, 2)).toBeCloseTo(0.6 / (Math.PI * 4), 5)
  })
})
