import { useEffect, useMemo, type ReactNode } from 'react'
import {
  DRILL_GROUPS,
  applyCenterDrillSize,
  createDrill,
  getDrillType,
  listDrillTypes,
  withSteps,
  type DrillFieldKey,
} from '../lib/drillTypes'
import {
  beginnerFieldKeys,
  drillCard,
  fieldHelp,
  starterTemplates,
  type ExperienceMode,
  type PreviewPart,
  type StarterTemplate,
} from '../lib/drillGuide'
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
import { FieldHelp } from './FieldHelp'

interface Props {
  drill: DrillParams
  setDrill: (drill: DrillParams) => void
  errors: FieldErrors
  mode: ExperienceMode
  showAdvanced: boolean
  onShowAdvanced: () => void
  onHighlight: (part: PreviewPart | null) => void
}

interface LibraryProps {
  drill: DrillParams
  setDrill: (drill: DrillParams) => void
  mode: ExperienceMode
  onMode: (mode: ExperienceMode) => void
  onTemplate: (template: StarterTemplate) => void
  onHelp: () => void
}

const WEB_OPTIONS: { value: WebThinningStyle; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'S', label: 'S-point' },
  { value: 'X', label: 'X-thinning' },
  { value: 'split', label: 'Split point' },
  { value: 'notched', label: 'Notched' },
]

export function DrillLibrary({ drill, setDrill, mode, onMode, onTemplate, onHelp }: LibraryProps) {
  const selected = getDrillType(drill.drillType)
  const selectedCard = drillCard(drill.drillType)
  const templates = useMemo(() => starterTemplates(), [])
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Drill library</h2>
        <div className="seg" role="group" aria-label="Experience">
          <button type="button" className={mode === 'beginner' ? 'active' : ''} onClick={() => onMode('beginner')}>
            Beginner
          </button>
          <button type="button" className={mode === 'expert' ? 'active' : ''} onClick={() => onMode('expert')}>
            Expert
          </button>
        </div>
      </div>
      <button type="button" className="btn accent wizard-launch" onClick={onHelp}>
        Help me choose
      </button>
      <p className="muted tiny">Starter jobs load a full setup you can edit.</p>
      {mode === 'expert' ? (
        <div className="chip-row wrap">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="chip"
              title={template.blurb}
              onClick={() => onTemplate(template)}
            >
              {template.title}
            </button>
          ))}
        </div>
      ) : (
        <div className="template-list">
          {templates.map((template) => (
            <button key={template.id} type="button" className="template-card" onClick={() => onTemplate(template)}>
              <strong>{template.title}</strong>
              <span>{template.blurb}</span>
            </button>
          ))}
        </div>
      )}
      {mode === 'beginner' && (
        <article className="type-card active">
          <strong>{selected.shortLabel}</strong>
          <p>{selectedCard.forWhat}</p>
          <p>
            <span className="card-k">Use when</span> {selectedCard.useWhen}
          </p>
          <p>
            <span className="card-k">Skip when</span> {selectedCard.avoidWhen}
          </p>
        </article>
      )}
      {mode === 'expert' ? (
        <>
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
          <article className="type-card active">
            <strong>{selected.shortLabel}</strong>
            <p>{selectedCard.forWhat}</p>
            <p>
              <span className="card-k">Use when</span> {selectedCard.useWhen}
            </p>
            <p>
              <span className="card-k">Skip when</span> {selectedCard.avoidWhen}
            </p>
          </article>
        </>
      ) : null}
    </div>
  )
}

export function DrillTypeCards({ drill, setDrill }: { drill: DrillParams; setDrill: (drill: DrillParams) => void }) {
  return (
    <div className="panel">
      <h2>Choose a drill type</h2>
      <p className="muted tiny">Each card says what the drill is for. Picking one loads its usual defaults.</p>
      {DRILL_GROUPS.map((group) => (
        <div key={group} className="drill-group">
          <div className="drill-group-label">{group}</div>
          <div className="card-grid">
            {listDrillTypes()
              .filter((type) => type.group === group)
              .map((type) => {
                const card = drillCard(type.id)
                return (
                  <button
                    key={type.id}
                    type="button"
                    className={`type-card ${drill.drillType === type.id ? 'active' : ''}`}
                    aria-pressed={drill.drillType === type.id}
                    onClick={() => setDrill(createDrill(type.id))}
                  >
                    <strong>{type.shortLabel}</strong>
                    <p>{card.forWhat}</p>
                    <p>
                      <span className="card-k">Use when</span> {card.useWhen}
                    </p>
                    <p>
                      <span className="card-k">Skip when</span> {card.avoidWhen}
                    </p>
                  </button>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function DrillFields({
  drill,
  setDrill,
  errors,
  mode,
  showAdvanced,
  onShowAdvanced,
  onHighlight,
}: Props) {
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

  const field = (key: DrillFieldKey, label: string, control: ReactNode, hint?: string) => {
    const help = fieldHelp(key)
    return (
      <label
        className="field"
        key={key}
        onMouseEnter={() => onHighlight(help.part)}
        onMouseLeave={(event) => {
          if (event.currentTarget.querySelector('.field-help.pinned')) return
          if (event.currentTarget.contains(document.activeElement)) return
          onHighlight(null)
        }}
        onFocusCapture={() => onHighlight(help.part)}
        onBlurCapture={(event) => {
          if (event.currentTarget.querySelector('.field-help.pinned')) return
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onHighlight(null)
        }}
      >
        <span className="field-label">
          {label}
          <FieldHelp help={help} />
        </span>
        {control}
        {hint && <span className="muted tiny">{hint}</span>}
        {errors[key] && <span className="field-error">{errors[key]}</span>}
      </label>
    )
  }

  const updateSteps = (steps: DrillStep[]) => setDrill(withSteps(drill, steps))

  const renderSteps = () => (
    <div
      className="steps-editor"
      key="steps"
      onMouseEnter={() => onHighlight('step')}
      onMouseLeave={() => onHighlight(null)}
      onFocusCapture={() => onHighlight('step')}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onHighlight(null)
      }}
    >
      <span className="field-label">
        Steps — diameter and length (tip is step 1)
        <FieldHelp help={fieldHelp('steps')} />
      </span>
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

  const beginner = beginnerFieldKeys(drill.drillType)
  const beginnerSet = new Set<string>(beginner)
  const advanced = def.fields.filter((key) => !beginnerSet.has(key))
  const ordered: DrillFieldKey[] =
    mode === 'expert'
      ? [...def.fields]
      : showAdvanced
        ? [...beginner.filter((key) => def.fields.includes(key)), ...advanced]
        : beginner.filter((key) => def.fields.includes(key))

  useEffect(() => {
    if (mode !== 'beginner' || showAdvanced) return
    const keys = new Set<string>(beginnerFieldKeys(drill.drillType))
    const hiddenError = Object.keys(errors).some((key) => {
      if (keys.has(key)) return false
      if (key.startsWith('step-') && keys.has('steps')) return false
      return true
    })
    if (hiddenError) onShowAdvanced()
  }, [mode, showAdvanced, errors, drill.drillType, onShowAdvanced])

  return (
    <>
      {ordered.map((key) => renderField(key))}
      {mode === 'beginner' && advanced.length > 0 && !showAdvanced && (
        <button type="button" className="btn" onClick={onShowAdvanced}>
          Show advanced
        </button>
      )}
      {mode === 'beginner' && showAdvanced && (
        <p className="muted tiny">Advanced fields are open. Web, margin, relief, and back taper live here.</p>
      )}
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
