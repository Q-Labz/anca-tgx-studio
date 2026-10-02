import { useMemo, useState } from 'react'
import type { DrillParams } from '../lib/types'
import { buildGrindPlan, type GrindPlan } from '../lib/grindPlan'
import type { GrindMode } from '../lib/grindOps'
import { downloadBlob } from '../lib/export'
import {
  ABRASIVES,
  CATALOG_PACKS,
  GRIT_LABELS,
  WHEEL_DUTIES,
  WHEEL_SHAPES,
  blankCustomPack,
  clonePack,
  defaultDuties,
  dutyLabel,
  formatWheelSize,
  mergeCustomPacks,
  parseWheelCatalog,
  serializeWheelCatalog,
  shapeLabel,
  validatePack,
  type Abrasive,
  type CatalogWheel,
  type GritLabel,
  type WheelDuty,
  type WheelPack,
  type WheelShape,
} from '../lib/wheelPacks'

interface Props {
  drill: DrillParams
  mode: GrindMode
  stockMm: number
  pack: WheelPack
  recommended: { pack: WheelPack; reason: string }
  packChoice: string | null
  customPacks: WheelPack[]
  plan: GrindPlan
  onChoose: (id: string | null) => void
  onCustomPacks: (packs: WheelPack[]) => void
}

type PackView = 'recommended' | 'catalog' | 'custom'

function newWheel(): CatalogWheel {
  const stamp = Date.now().toString(36)
  return {
    id: `wheel-${stamp}-${Math.random().toString(36).slice(2, 5)}`,
    name: 'Wheel',
    shape: '1A1',
    diameterMm: 100,
    widthMm: 10,
    abrasive: 'diamond',
    grit: 'medium',
    duties: defaultDuties('1A1'),
  }
}

export function WheelPackEditor({
  drill,
  mode,
  stockMm,
  pack,
  recommended,
  packChoice,
  customPacks,
  plan,
  onChoose,
  onCustomPacks,
}: Props) {
  const [view, setView] = useState<PackView>('recommended')
  const [draft, setDraft] = useState<WheelPack | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const livePlan = useMemo(() => {
    if (!draft) return plan
    return buildGrindPlan(drill, mode, draft, stockMm)
  }, [draft, drill, mode, stockMm, plan])

  const flash = (message: string) => {
    setNote(message)
    setTimeout(() => setNote(null), 2200)
  }

  const saveDraft = () => {
    if (!draft) return
    const problem = validatePack(draft)
    if (problem) {
      setError(problem)
      return
    }
    const next = customPacks.some((item) => item.id === draft.id)
      ? customPacks.map((item) => (item.id === draft.id ? draft : item))
      : [...customPacks, draft]
    onCustomPacks(next)
    onChoose(draft.id)
    setError(null)
    flash('Pack saved on this browser')
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    const parsed = parseWheelCatalog(await file.text())
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    const merged = mergeCustomPacks(customPacks, parsed.packs)
    if (merged.packs.length === customPacks.length && merged.skipped.length > 0) {
      setError('Those ids match the sample packs already in the app. Give shop packs their own ids.')
      return
    }
    onCustomPacks(merged.packs)
    setError(null)
    const skipped = merged.skipped.length > 0 ? ` Skipped sample ids: ${merged.skipped.join(', ')}.` : ''
    flash(`Imported wheel catalog.${skipped}`)
  }

  return (
    <div className="panel wheel-editor" data-testid="wheel-editor">
      <div className="panel-head">
        <h2>Wheel pack</h2>
        <div className="seg cols-3" role="group" aria-label="Wheel pack source">
          <button type="button" className={view === 'recommended' ? 'active' : ''} onClick={() => setView('recommended')}>
            Recommended
          </button>
          <button type="button" className={view === 'catalog' ? 'active' : ''} onClick={() => setView('catalog')}>
            Full list
          </button>
          <button
            type="button"
            className={view === 'custom' ? 'active' : ''}
            data-testid="pack-custom"
            onClick={() => setView('custom')}
          >
            Custom
          </button>
        </div>
      </div>
      <p className="muted tiny">
        Sample packs are generic. Import or export <code>tgxStudioWheelCatalog</code> JSON when the shop replaces them
        with real inventory. No ANCA part numbers.
      </p>

      {livePlan.warnings.length > 0 && (
        <ul className="grind-warnings" data-testid="pack-warnings">
          {livePlan.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      {view === 'recommended' && (
        <div>
          <p>
            <strong>{recommended.pack.name}</strong>
            {packChoice === null && <span className="tag">In use</span>}
          </p>
          <p className="muted">{recommended.reason}</p>
          {packChoice !== null && (
            <button type="button" className="btn sm" onClick={() => onChoose(null)}>
              Use recommended
            </button>
          )}
          <WheelList wheels={recommended.pack.wheels} />
        </div>
      )}

      {view === 'catalog' && (
        <ul className="pack-list">
          {CATALOG_PACKS.map((item) => (
            <li key={item.id} className={pack.id === item.id && packChoice !== null ? 'active' : ''}>
              <div>
                <strong>{item.name}</strong>
                <p className="muted tiny">{item.notes}</p>
              </div>
              <button type="button" className="btn sm" onClick={() => onChoose(item.id)}>
                {packChoice === item.id ? 'In use' : 'Use'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {view === 'custom' && (
        <div data-testid="pack-editor">
          <div className="btn-row wrap">
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                setDraft(blankCustomPack())
                setError(null)
              }}
            >
              New pack
            </button>
            <button
              type="button"
              className="btn sm"
              onClick={() => downloadBlob('wheel-catalog-sample.json', serializeWheelCatalog(CATALOG_PACKS), 'application/json')}
            >
              Export sample catalog
            </button>
            <button
              type="button"
              className="btn sm"
              onClick={() =>
                downloadBlob('wheel-catalog-custom.json', serializeWheelCatalog(customPacks), 'application/json')
              }
            >
              Export custom packs
            </button>
            <label className="btn sm">
              Import JSON
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  void onImport(file)
                  event.target.value = ''
                }}
              />
            </label>
          </div>

          {customPacks.length > 0 && (
            <ul className="pack-list">
              {customPacks.map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  <div className="btn-row">
                    <button type="button" className="btn sm" onClick={() => onChoose(item.id)}>
                      {packChoice === item.id ? 'In use' : 'Use'}
                    </button>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => {
                        setDraft(clonePack(item))
                        setError(null)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn sm danger"
                      onClick={() => {
                        onCustomPacks(customPacks.filter((packItem) => packItem.id !== item.id))
                        if (packChoice === item.id) onChoose(null)
                        if (draft?.id === item.id) setDraft(null)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {draft && (
            <form
              className="pack-draft"
              data-testid="pack-draft"
              onSubmit={(event) => {
                event.preventDefault()
                saveDraft()
              }}
            >
              <label className="field">
                <span className="field-label">Pack name</span>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">Notes</span>
                <input
                  value={draft.notes}
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                />
              </label>
              {draft.wheels.map((wheel, index) => (
                <fieldset key={wheel.id} className="wheel-fields">
                  <legend>
                    Wheel {index + 1}
                    <button
                      type="button"
                      className="btn sm danger"
                      onClick={() =>
                        setDraft({ ...draft, wheels: draft.wheels.filter((item) => item.id !== wheel.id) })
                      }
                    >
                      Remove
                    </button>
                  </legend>
                  <label className="field">
                    <span className="field-label">Name</span>
                    <input
                      value={wheel.name}
                      onChange={(event) => updateWheel(setDraft, draft, wheel.id, { name: event.target.value })}
                    />
                  </label>
                  <div className="form-grid">
                    <label className="field">
                      <span className="field-label">Shape</span>
                      <select
                        value={wheel.shape}
                        onChange={(event) => {
                          const shape = event.target.value as WheelShape
                          updateWheel(setDraft, draft, wheel.id, { shape, duties: defaultDuties(shape) })
                        }}
                      >
                        {WHEEL_SHAPES.map((shape) => (
                          <option key={shape} value={shape}>
                            {shapeLabel(shape)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span className="field-label">Diameter (mm)</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={wheel.diameterMm}
                        onChange={(event) =>
                          updateWheel(setDraft, draft, wheel.id, { diameterMm: Number(event.target.value) })
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">Width (mm)</span>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={wheel.widthMm}
                        onChange={(event) =>
                          updateWheel(setDraft, draft, wheel.id, { widthMm: Number(event.target.value) })
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">Abrasive</span>
                      <select
                        value={wheel.abrasive}
                        onChange={(event) =>
                          updateWheel(setDraft, draft, wheel.id, { abrasive: event.target.value as Abrasive })
                        }
                      >
                        {ABRASIVES.map((abrasive) => (
                          <option key={abrasive} value={abrasive}>
                            {abrasive === 'cbn' ? 'CBN' : 'diamond'}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span className="field-label">Grit</span>
                      <select
                        value={wheel.grit}
                        onChange={(event) =>
                          updateWheel(setDraft, draft, wheel.id, { grit: event.target.value as GritLabel })
                        }
                      >
                        {GRIT_LABELS.map((grit) => (
                          <option key={grit} value={grit}>
                            {grit}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="duty-checks">
                    <span className="field-label">This wheel can grind</span>
                    {WHEEL_DUTIES.map((duty) => (
                      <label key={duty}>
                        <input
                          type="checkbox"
                          checked={wheel.duties.includes(duty)}
                          onChange={() => toggleDuty(setDraft, draft, wheel.id, duty)}
                        />
                        {dutyLabel(duty)}
                      </label>
                    ))}
                  </div>
                  <p className="muted tiny">Changing the shape resets these jobs. Tick what this wheel actually does.</p>
                </fieldset>
              ))}
              <div className="btn-row wrap">
                <button type="button" className="btn sm" onClick={() => setDraft({ ...draft, wheels: [...draft.wheels, newWheel()] })}>
                  Add wheel
                </button>
                <button type="submit" className="btn primary sm" data-testid="pack-save">
                  Save pack locally
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <h3 className="grind-subhead">Which wheel does each operation</h3>
      <ul className="assign-list">
        {livePlan.operations.map((op) => (
          <li key={op.id} className={op.warning ? 'warn' : ''}>
            <span>{op.title}</span>
            <span>{op.wheelName ? `${op.wheelShape} ${op.wheelName}` : 'No wheel'}</span>
            <span className="muted">{op.forms}</span>
          </li>
        ))}
      </ul>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {note && <p className="toast">{note}</p>}
    </div>
  )
}

function WheelList({ wheels }: { wheels: CatalogWheel[] }) {
  return (
    <ul className="wheel-brief">
      {wheels.map((wheel) => (
        <li key={wheel.id}>
          <strong>{wheel.name}</strong>
          <span className="muted tiny">{formatWheelSize(wheel)}</span>
          <span className="muted tiny">{wheel.duties.map((duty) => dutyLabel(duty)).join(' · ')}</span>
        </li>
      ))}
    </ul>
  )
}

function updateWheel(
  setDraft: (pack: WheelPack) => void,
  draft: WheelPack,
  id: string,
  patch: Partial<CatalogWheel>,
) {
  setDraft({
    ...draft,
    wheels: draft.wheels.map((wheel) => (wheel.id === id ? { ...wheel, ...patch } : wheel)),
  })
}

function toggleDuty(
  setDraft: (pack: WheelPack) => void,
  draft: WheelPack,
  id: string,
  duty: WheelDuty,
) {
  setDraft({
    ...draft,
    wheels: draft.wheels.map((wheel) => {
      if (wheel.id !== id) return wheel
      const duties = wheel.duties.includes(duty)
        ? wheel.duties.filter((item) => item !== duty)
        : [...wheel.duties, duty]
      return { ...wheel, duties }
    }),
  })
}
