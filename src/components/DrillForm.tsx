import type { ReactNode } from 'react'
import {
  DRILL_GROUPS,
  applyCenterDrillSize,
  createDrill,
  getDrillType,
  listDrillTypes,
  withSteps,
  type DrillFieldKey,
} from '../lib/drillTypes'
import type {
  CenterDrillSize,
  DrillParams,
  DrillStep,
  GunFluteStyle,
  ToolMaterial,
  WebThinningStyle,
} from '../lib/types'
import { CENTER_DRILL_SIZES } from '../lib/types'
import type { FieldErrors } from '../lib/validation'

interface Props {
  drill: DrillParams
  setDrill: (drill: DrillParams) => void
  errors: FieldErrors
}

const WEB_OPTIONS: { value: WebThinningStyle; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'S', label: 'S-point' },
  { value: 'X', label: 'X-thinning' },
  { value: 'split', label: 'Split point' },
  { value: 'notched', label: 'Notched' },
]

export function DrillLibrary({ drill, setDrill }: Omit<Props, 'errors'>) {
  const selected = getDrillType(drill.drillType)
  return (
    <div className="panel">
      <h2>Drill library</h2>
      <p className="muted tiny">Pick a family. Each one loads shop-typical defaults you can edit.</p>
      {DRILL_GROUPS.map((group) => (
        <div key={group} className="drill-group">
          <div className="drill-group-label">{group}</div>
          <div className="chip-row wrap">
            {listDrillTypes()
              .filter((type) => type.group === group)
              .map((type) => (
                <button
                  key={type.id}
                  type="button"
                  className={`chip ${drill.drillType === type.id ? 'active' : ''}`}
                  aria-pressed={drill.drillType === type.id}
                  title={type.summary}
                  onClick={() => setDrill(createDrill(type.id))}
                >
                  {type.shortLabel}
                </button>
              ))}
          </div>
        </div>
      ))}
      <p className="hint muted">{selected.summary}</p>
    </div>
  )
}

export function DrillFields({ drill, setDrill, errors }: Props) {
  const def = getDrillType(drill.drillType)
  const shown = new Set<string>(def.fields)
  if (def.fields.includes('steps')) {
    drill.steps.forEach((_, index) => {
      shown.add(`step-${index}-diameter`)
      shown.add(`step-${index}-length`)
    })
  }
  const orphans = Object.entries(errors).filter(([key]) => !shown.has(key))

  const setNum = (key: keyof DrillParams, value: number) => {
    setDrill({ ...drill, [key]: value })
  }

  const numberInput = (value: number, onChange: (n: number) => void, step = 0.1) => (
    <input
      type="number"
      step={step}
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )

  const field = (key: string, label: string, control: ReactNode, hint?: string) => (
    <label className="field" key={key}>
      <span className="field-label">{label}</span>
      {control}
      {hint && <span className="muted tiny">{hint}</span>}
      {errors[key] && <span className="field-error">{errors[key]}</span>}
    </label>
  )

  const updateSteps = (steps: DrillStep[]) => setDrill(withSteps(drill, steps))

  const renderSteps = () => (
    <div className="steps-editor" key="steps">
      <span className="field-label">Steps — diameter and length (tip is step 1)</span>
      {drill.steps.map((step, index) => (
        <div className="step-row" key={index}>
          <span className="step-index">{index + 1}</span>
          <label className="field">
            <span className="field-label">Diameter (mm)</span>
            {numberInput(step.diameter, (n) => {
              const next = drill.steps.map((item, i) => (i === index ? { ...item, diameter: n } : item))
              updateSteps(next)
            })}
            {errors[`step-${index}-diameter`] && (
              <span className="field-error">{errors[`step-${index}-diameter`]}</span>
            )}
          </label>
          <label className="field">
            <span className="field-label">Length (mm)</span>
            {numberInput(step.length, (n) => {
              const next = drill.steps.map((item, i) => (i === index ? { ...item, length: n } : item))
              updateSteps(next)
            })}
            {errors[`step-${index}-length`] && (
              <span className="field-error">{errors[`step-${index}-length`]}</span>
            )}
          </label>
          <button
            type="button"
            className="btn sm danger"
            disabled={drill.steps.length <= 2}
            onClick={() => updateSteps(drill.steps.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      {errors.steps && <span className="field-error">{errors.steps}</span>}
      <button
        type="button"
        className="btn sm"
        disabled={drill.steps.length >= 6}
        onClick={() => {
          const last = drill.steps[drill.steps.length - 1]
          updateSteps([
            ...drill.steps,
            {
              diameter: Math.round((last.diameter + 2) * 100) / 100,
              length: Math.round(Math.max(6, last.length * 0.8) * 100) / 100,
            },
          ])
        }}
      >
        Add step
      </button>
    </div>
  )

  const renderField = (key: DrillFieldKey): ReactNode => {
    switch (key) {
      case 'name':
        return field(
          'name',
          'Name',
          <input type="text" value={drill.name} onChange={(e) => setDrill({ ...drill, name: e.target.value })} />,
        )
      case 'diameter':
        return field('diameter', 'Diameter (mm)', numberInput(drill.diameter, (n) => setNum('diameter', n)))
      case 'pointAngle':
        return field(
          'pointAngle',
          'Point angle (°)',
          <div className="inline-row">
            {numberInput(drill.pointAngle, (n) => setNum('pointAngle', n), 1)}
            {def.pointChips.length > 0 && (
              <div className="chip-row wrap">
                {def.pointChips.map((angle) => (
                  <button
                    key={angle}
                    type="button"
                    className={`chip ${drill.pointAngle === angle ? 'active' : ''}`}
                    onClick={() => setNum('pointAngle', angle)}
                  >
                    {angle}°
                  </button>
                ))}
              </div>
            )}
          </div>,
        )
      case 'fluteCount':
        return field(
          'fluteCount',
          'Flute count',
          <input
            type="number"
            min={def.limits.fluteCount.min}
            max={def.limits.fluteCount.max}
            step={1}
            value={drill.fluteCount}
            onChange={(e) => {
              const fluteCount = Number(e.target.value)
              const gunFluteStyle: GunFluteStyle =
                drill.drillType === 'gun' ? (fluteCount >= 2 ? 'v' : 'single') : drill.gunFluteStyle
              setDrill({ ...drill, fluteCount, gunFluteStyle })
            }}
          />,
        )
      case 'helixAngle':
        return field('helixAngle', 'Helix angle (°)', numberInput(drill.helixAngle, (n) => setNum('helixAngle', n), 1))
      case 'overallLength':
        return field(
          'overallLength',
          'Overall length (mm)',
          numberInput(drill.overallLength, (n) => setNum('overallLength', n)),
        )
      case 'fluteLength':
        return field(
          'fluteLength',
          drill.drillType === 'subland' ? 'Front land length (mm)' : 'Flute length (mm)',
          numberInput(drill.fluteLength, (n) => setNum('fluteLength', n)),
        )
      case 'shankDiameter':
        return field(
          'shankDiameter',
          'Shank diameter (mm)',
          numberInput(drill.shankDiameter, (n) => setNum('shankDiameter', n)),
        )
      case 'shankLength':
        return field('shankLength', 'Shank length (mm)', numberInput(drill.shankLength, (n) => setNum('shankLength', n)))
      case 'webThickness':
        return field(
          'webThickness',
          'Web thickness (mm)',
          numberInput(drill.webThickness, (n) => setNum('webThickness', n), 0.01),
          drill.diameter > 0 ? `${Math.round((drill.webThickness / drill.diameter) * 100)}% of diameter` : undefined,
        )
      case 'webThinning':
        return field(
          'webThinning',
          'Web thinning',
          <select
            value={drill.webThinning}
            onChange={(e) => setDrill({ ...drill, webThinning: e.target.value as WebThinningStyle })}
          >
            {WEB_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>,
        )
      case 'webThinningNote':
        return field(
          'webThinningNote',
          'Web thinning note',
          <input
            type="text"
            value={drill.webThinningNote}
            placeholder="Optional grind note"
            onChange={(e) => setDrill({ ...drill, webThinningNote: e.target.value })}
          />,
        )
      case 'marginWidth':
        return field('marginWidth', 'Margin width (mm)', numberInput(drill.marginWidth, (n) => setNum('marginWidth', n), 0.01))
      case 'bodyClearance':
        return field(
          'bodyClearance',
          'Body clearance (mm on diameter)',
          numberInput(drill.bodyClearance, (n) => setNum('bodyClearance', n), 0.01),
        )
      case 'lipReliefAngle':
        return field(
          'lipReliefAngle',
          'Lip relief (°)',
          numberInput(drill.lipReliefAngle, (n) => setNum('lipReliefAngle', n), 0.5),
        )
      case 'backTaper':
        return field(
          'backTaper',
          'Back taper (mm / 100 mm)',
          numberInput(drill.backTaper, (n) => setNum('backTaper', n), 0.01),
        )
      case 'coolantHoles':
        return field(
          'coolantHoles',
          'Coolant holes',
          <input
            type="number"
            min={0}
            max={drill.drillType === 'gun' ? 1 : 2}
            step={1}
            value={drill.coolantHoles}
            onChange={(e) => setNum('coolantHoles', Number(e.target.value))}
          />,
        )
      case 'coolantHoleDiameter':
        if (drill.coolantHoles <= 0) return null
        return field(
          'coolantHoleDiameter',
          'Coolant hole diameter (mm)',
          numberInput(drill.coolantHoleDiameter, (n) => setNum('coolantHoleDiameter', n), 0.01),
        )
      case 'steps':
        return renderSteps()
      case 'sublandDiameter':
        return field(
          'sublandDiameter',
          'Subland diameter (mm)',
          numberInput(drill.sublandDiameter, (n) => setNum('sublandDiameter', n)),
        )
      case 'sublandLength':
        return field(
          'sublandLength',
          'Subland length (mm)',
          numberInput(drill.sublandLength, (n) => setNum('sublandLength', n)),
        )
      case 'centerSize':
        return field(
          'centerSize',
          'Center size (ANSI, mm values)',
          <div className="chip-row wrap">
            {CENTER_DRILL_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                className={`chip ${drill.centerSize === size ? 'active' : ''}`}
                onClick={() => setDrill(applyCenterDrillSize(drill, size as CenterDrillSize))}
              >
                {size}
              </button>
            ))}
          </div>,
        )
      case 'countersinkAngle':
        return field(
          'countersinkAngle',
          'Countersink angle (°)',
          <div className="inline-row">
            {numberInput(drill.countersinkAngle, (n) => setNum('countersinkAngle', n), 1)}
            <div className="chip-row">
              {[60, 82, 90].map((angle) => (
                <button
                  key={angle}
                  type="button"
                  className={`chip ${drill.countersinkAngle === angle ? 'active' : ''}`}
                  onClick={() => setNum('countersinkAngle', angle)}
                >
                  {angle}°
                </button>
              ))}
            </div>
          </div>,
        )
      case 'countersinkDiameter':
        return field(
          'countersinkDiameter',
          'Countersink diameter (mm)',
          numberInput(drill.countersinkDiameter, (n) => setNum('countersinkDiameter', n)),
        )
      case 'pilotLength':
        return field('pilotLength', 'Pilot length (mm)', numberInput(drill.pilotLength, (n) => setNum('pilotLength', n)))
      case 'chamferAngle':
        return field(
          'chamferAngle',
          'Chamfer angle (° included)',
          <div className="inline-row">
            {numberInput(drill.chamferAngle, (n) => setNum('chamferAngle', n), 1)}
            <div className="chip-row">
              {[60, 82, 90, 120].map((angle) => (
                <button
                  key={angle}
                  type="button"
                  className={`chip ${drill.chamferAngle === angle ? 'active' : ''}`}
                  onClick={() => setNum('chamferAngle', angle)}
                >
                  {angle}°
                </button>
              ))}
            </div>
          </div>,
        )
      case 'chamferDiameter':
        return field(
          'chamferDiameter',
          'Chamfer diameter (mm)',
          numberInput(drill.chamferDiameter, (n) => setNum('chamferDiameter', n)),
        )
      case 'gunFluteStyle':
        return field(
          'gunFluteStyle',
          'Gun flute',
          <div className="chip-row">
            <button
              type="button"
              className={`chip ${drill.gunFluteStyle === 'single' ? 'active' : ''}`}
              onClick={() => setDrill({ ...drill, gunFluteStyle: 'single', fluteCount: 1 })}
            >
              Single flute
            </button>
            <button
              type="button"
              className={`chip ${drill.gunFluteStyle === 'v' ? 'active' : ''}`}
              onClick={() => setDrill({ ...drill, gunFluteStyle: 'v', fluteCount: 2 })}
            >
              V-flute
            </button>
          </div>,
        )
      case 'coating':
        return field(
          'coating',
          'Coating',
          <input type="text" value={drill.coating} onChange={(e) => setDrill({ ...drill, coating: e.target.value })} />,
        )
      case 'material':
        return field(
          'material',
          'Material',
          <select
            value={drill.material}
            onChange={(e) => setDrill({ ...drill, material: e.target.value as ToolMaterial })}
          >
            <option value="carbide">Carbide</option>
            <option value="HSS">HSS</option>
          </select>,
        )
      default: {
        const exhaustive: never = key
        return exhaustive
      }
    }
  }

  return (
    <>
      {def.fields.map((key) => renderField(key))}
      {orphans.length > 0 && (
        <div className="field-error" key="orphans">
          {orphans.map(([key, message]) => (
            <div key={key}>{message}</div>
          ))}
        </div>
      )}
    </>
  )
}
