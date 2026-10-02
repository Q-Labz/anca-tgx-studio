import type { OpStep, WheelRow } from './types'
import { uid } from './types'
import {
  grindOps,
  type GrindMode,
  type GrindOp,
  type GrindSequence,
  type GrindStage,
} from './grindOps'
import type { DrillParams } from './types'
import {
  GRIND_DISCLAIMER,
  missingDutyWarning,
  wheelForDuty,
  type WheelDuty,
  type WheelPack,
} from './wheelPacks'

export interface AssignedGrindOp extends GrindOp {
  wheelId: string | null
  wheelName: string | null
  wheelShape: string | null
  warning: string | null
}

export interface GrindPlan {
  disclaimer: string
  mode: GrindMode
  stockRemovedMm: number | null
  pack: WheelPack
  initialShow: GrindStage[]
  operations: AssignedGrindOp[]
  warnings: string[]
}

export function isWheelDuty(duty: GrindOp['duty']): duty is WheelDuty {
  return duty !== 'inspect' && duty !== 'blank-feature'
}

export function buildGrindPlan(
  drill: DrillParams,
  mode: GrindMode,
  pack: WheelPack,
  stockMm: number,
): GrindPlan {
  const sequence: GrindSequence = grindOps(drill, mode, stockMm)
  const operations: AssignedGrindOp[] = sequence.operations.map((op) => {
    if (!isWheelDuty(op.duty)) {
      return { ...op, wheelId: null, wheelName: null, wheelShape: null, warning: null }
    }
    const wheel = wheelForDuty(pack, op.duty)
    if (!wheel) {
      return {
        ...op,
        wheelId: null,
        wheelName: null,
        wheelShape: null,
        warning: missingDutyWarning(op.duty),
      }
    }
    return {
      ...op,
      wheelId: wheel.id,
      wheelName: wheel.name,
      wheelShape: wheel.shape,
      warning: null,
    }
  })
  const warnings = [
    ...new Set(operations.map((op) => op.warning).filter((warning): warning is string => warning !== null)),
  ]
  return {
    disclaimer: GRIND_DISCLAIMER,
    mode,
    stockRemovedMm: mode === 'resharpen' ? sequence.stockRemovedMm : null,
    pack,
    initialShow: sequence.initialShow,
    operations,
    warnings,
  }
}

export function travelerWheelsFromPack(pack: WheelPack): WheelRow[] {
  return pack.wheels.map((wheel) => ({
    id: uid('wh'),
    name: `${wheel.shape} ${wheel.name}`,
    grit: `${wheel.abrasive} · ${wheel.grit}`,
    size: `${wheel.diameterMm}×${wheel.widthMm} mm`,
  }))
}

export function travelerOpsFromPlan(plan: GrindPlan): OpStep[] {
  return plan.operations.map((op) => ({
    id: uid('op'),
    label: op.wheelName ? `${op.title} — ${op.wheelName}` : op.title,
    done: false,
    notes: op.warning ?? `Forms ${op.forms}`,
  }))
}
