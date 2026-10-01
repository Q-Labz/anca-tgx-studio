import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  DrillParams,
  EndmillParams,
  SavedDesign,
  ToolMaterial,
  ToolType,
} from '../lib/types'
import { DEFAULT_ENDMILL, uid } from '../lib/types'
import { createDrill, getDrillType, normalizeDrill } from '../lib/drillTypes'
import {
  adoptType,
  adviseDrill,
  readExperienceMode,
  workpieceLabel,
  writeExperienceMode,
  type ExperienceMode,
  type PreviewPart,
  type StarterTemplate,
  type WorkpieceMaterial,
} from '../lib/drillGuide'
import { snapshotFromDesign } from '../lib/designSnapshot'
import { deleteDesign, listDesigns, saveDesign } from '../lib/storage'
import { validateTool } from '../lib/validation'
import { DISCLAIMER, exportDesignCsv, exportDesignJson } from '../lib/export'
import { DrillFields, DrillLibrary, DrillTypeCards } from './DrillForm'
import { DrillWizard } from './DrillWizard'
import { ToolPreview } from './ToolPreview'

interface Props {
  toolType: ToolType
  setToolType: (t: ToolType) => void
  endmill: EndmillParams
  setEndmill: (p: EndmillParams) => void
  drill: DrillParams
  setDrill: (p: DrillParams) => void
  designId: string | null
  setDesignId: (id: string | null) => void
  onCreateTraveler: (design: SavedDesign) => void
}

export function Designer({
  toolType,
  setToolType,
  endmill,
  setEndmill,
  drill,
  setDrill,
  designId,
  setDesignId,
  onCreateTraveler,
}: Props) {
  const [designs, setDesigns] = useState<SavedDesign[]>(() => listDesigns())
  const [message, setMessage] = useState<string | null>(null)
  const [showSetupSheet, setShowSetupSheet] = useState(false)
  const [mode, setMode] = useState<ExperienceMode>(() => readExperienceMode())
  const [workpiece, setWorkpiece] = useState<WorkpieceMaterial | null>(null)
  const [highlight, setHighlight] = useState<PreviewPart | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const stashRef = useRef<{ drill: DrillParams; workpiece: WorkpieceMaterial | null } | null>(null)
  const openAdvanced = useCallback(() => setShowAdvanced(true), [])

  const params = toolType === 'endmill' ? endmill : drill
  const errors = useMemo(() => validateTool(toolType, params), [toolType, params])
  const valid = Object.keys(errors).length === 0
  const advisories = useMemo(
    () => (toolType === 'drill' ? adviseDrill(drill, workpiece) : []),
    [toolType, drill, workpiece],
  )

  const changeMode = (next: ExperienceMode) => {
    setMode(next)
    writeExperienceMode(next)
    if (next === 'expert') setShowAdvanced(false)
  }

  const openWizard = () => {
    stashRef.current = { drill, workpiece }
    setWizardOpen(true)
  }

  const cancelWizard = () => {
    const stash = stashRef.current
    if (stash) {
      setDrill(stash.drill)
      setWorkpiece(stash.workpiece)
    }
    setWizardOpen(false)
  }

  const acceptWizard = (next: DrillParams, material: WorkpieceMaterial) => {
    setDrill(next)
    setWorkpiece(material)
    setDesignId(null)
    setWizardOpen(false)
    setShowAdvanced(false)
    flash(`Using ${getDrillType(next.drillType).shortLabel}`)
  }

  const applyTemplate = (template: StarterTemplate) => {
    setDrill({
      ...template.drill,
      steps: template.drill.steps.map((step) => ({ ...step })),
    })
    setWorkpiece(template.workpiece)
    setDesignId(null)
    setShowAdvanced(false)
    setWizardOpen(false)
    flash(`Loaded “${template.title}”`)
  }

  const refresh = () => setDesigns(listDesigns())

  const flash = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 2500)
  }

  const currentAsDesign = (): SavedDesign => {
    const now = new Date().toISOString()
    return {
      id: designId ?? uid('des'),
      toolType,
      params: toolType === 'endmill' ? { ...endmill } : { ...drill },
      createdAt: designs.find((d) => d.id === designId)?.createdAt ?? now,
      updatedAt: now,
    }
  }

  const handleSave = () => {
    if (!valid) {
      flash('Fix validation errors before saving')
      return
    }
    const d = currentAsDesign()
    saveDesign(d)
    setDesignId(d.id)
    refresh()
    flash(`Saved “${(d.params as { name: string }).name}”`)
  }

  const handleLoad = (d: SavedDesign) => {
    setToolType(d.toolType)
    setDesignId(d.id)
    if (d.toolType === 'endmill') setEndmill(d.params as EndmillParams)
    else setDrill(normalizeDrill(d.params))
    setWorkpiece(null)
    setWizardOpen(false)
    flash(`Loaded “${(d.params as { name: string }).name}”`)
  }

  const handleDelete = (id: string) => {
    deleteDesign(id)
    if (designId === id) setDesignId(null)
    refresh()
    flash('Design deleted')
  }

  const handleNew = () => {
    setDesignId(null)
    setWorkpiece(null)
    setWizardOpen(false)
    if (toolType === 'endmill') setEndmill({ ...DEFAULT_ENDMILL })
    else setDrill(createDrill(drill.drillType))
    flash('New design')
  }

  const handleExport = (kind: 'json' | 'csv' | 'sheet') => {
    if (!valid) {
      flash('Fix validation errors before export')
      return
    }
    const d = currentAsDesign()
    if (kind === 'json') {
      exportDesignJson(d)
      flash('JSON downloaded')
    } else if (kind === 'csv') {
      exportDesignCsv(d)
      flash('CSV downloaded')
    } else {
      setShowSetupSheet(true)
      setTimeout(() => window.print(), 100)
    }
  }

  const num = (
    value: number | null,
    onChange: (n: number | null) => void,
    opts?: { nullable?: boolean; step?: number },
  ) => (
    <input
      type="number"
      step={opts?.step ?? 0.1}
      value={value === null || value === undefined ? '' : value}
      onChange={(e) => {
        const v = e.target.value
        if (opts?.nullable && v === '') onChange(null)
        else onChange(Number(v))
      }}
    />
  )

  const field = (key: string, label: string, control: ReactNode) => (
    <label className="field" key={key}>
      <span className="field-label">{label}</span>
      {control}
      {errors[key] && <span className="field-error">{errors[key]}</span>}
    </label>
  )

  return (
    <div className="tab-layout">
      <aside className="sidebar">
        <div className="panel">
          <div className="panel-head">
            <h2>Tool type</h2>
            <button type="button" className="btn ghost" onClick={handleNew}>
              New
            </button>
          </div>
          <div className="seg">
            <button
              type="button"
              className={toolType === 'endmill' ? 'active' : ''}
              onClick={() => {
                setToolType('endmill')
                setDesignId(null)
              }}
            >
              Solid endmill
            </button>
            <button
              type="button"
              className={toolType === 'drill' ? 'active' : ''}
              onClick={() => {
                setToolType('drill')
                setDesignId(null)
              }}
            >
              Drill
            </button>
          </div>
          <p className="hint muted">Reamer stub reserved for later.</p>
        </div>

        {toolType === 'drill' && wizardOpen && (
          <DrillWizard onCancel={cancelWizard} onPreview={(next, material) => {
            setDrill(next)
            setWorkpiece(material)
          }} onAccept={acceptWizard} />
        )}

        {toolType === 'drill' && !wizardOpen && (
          <DrillLibrary
            drill={drill}
            setDrill={(next) => {
              setDrill(next)
              setShowAdvanced(false)
            }}
            mode={mode}
            onMode={changeMode}
            onTemplate={applyTemplate}
            onHelp={openWizard}
          />
        )}

        {!wizardOpen && (
        <div className="panel form-panel">
          <h2>Parameters</h2>
          {toolType === 'drill' && workpiece && (
            <p className="hint">
              Workpiece: {workpieceLabel(workpiece)}{' '}
              <button type="button" className="btn ghost sm" onClick={() => setWorkpiece(null)}>
                Clear
              </button>
            </p>
          )}
          <div className="form-grid">
            {toolType === 'drill' ? (
              <DrillFields
                drill={drill}
                setDrill={setDrill}
                errors={errors}
                mode={mode}
                showAdvanced={showAdvanced}
                onShowAdvanced={openAdvanced}
                onHighlight={setHighlight}
              />
            ) : (
              <>
                {field(
                  'name',
                  'Name',
                  <input
                    type="text"
                    value={endmill.name}
                    onChange={(e) => setEndmill({ ...endmill, name: e.target.value })}
                  />,
                )}
                {field(
                  'diameter',
                  'Diameter (mm)',
                  num(endmill.diameter, (n) => setEndmill({ ...endmill, diameter: n ?? 0 })),
                )}
                {field(
                  'fluteCount',
                  'Flute count',
                  <input
                    type="number"
                    min={2}
                    max={8}
                    step={1}
                    value={endmill.fluteCount}
                    onChange={(e) => setEndmill({ ...endmill, fluteCount: Number(e.target.value) })}
                  />,
                )}
                {field(
                  'helixAngle',
                  'Helix angle (°)',
                  num(endmill.helixAngle, (n) => setEndmill({ ...endmill, helixAngle: n ?? 0 })),
                )}
                {field(
                  'overallLength',
                  'Overall length (mm)',
                  num(endmill.overallLength, (n) => setEndmill({ ...endmill, overallLength: n ?? 0 })),
                )}
                {field(
                  'fluteLength',
                  'Flute length (mm)',
                  num(endmill.fluteLength, (n) => setEndmill({ ...endmill, fluteLength: n ?? 0 })),
                )}
                {field(
                  'shankDiameter',
                  'Shank diameter (mm)',
                  num(endmill.shankDiameter, (n) => setEndmill({ ...endmill, shankDiameter: n ?? 0 })),
                )}
                {field(
                  'shankLength',
                  'Shank length (mm)',
                  num(endmill.shankLength, (n) => setEndmill({ ...endmill, shankLength: n ?? 0 })),
                )}
                {field(
                  'cornerRadius',
                  'Corner radius (mm, 0 = square)',
                  num(endmill.cornerRadius, (n) => setEndmill({ ...endmill, cornerRadius: n ?? 0 })),
                )}
                {field(
                  'neckDiameter',
                  'Neck diameter (optional)',
                  num(endmill.neckDiameter, (n) => setEndmill({ ...endmill, neckDiameter: n }), {
                    nullable: true,
                  }),
                )}
                {field(
                  'neckLength',
                  'Neck length (optional)',
                  num(endmill.neckLength, (n) => setEndmill({ ...endmill, neckLength: n }), {
                    nullable: true,
                  }),
                )}
                {field(
                  'coating',
                  'Coating',
                  <input
                    type="text"
                    value={endmill.coating}
                    onChange={(e) => setEndmill({ ...endmill, coating: e.target.value })}
                  />,
                )}
                {field(
                  'material',
                  'Material',
                  <select
                    value={endmill.material}
                    onChange={(e) => setEndmill({ ...endmill, material: e.target.value as ToolMaterial })}
                  >
                    <option value="carbide">Carbide</option>
                    <option value="HSS">HSS</option>
                  </select>,
                )}
              </>
            )}
          </div>

          {toolType === 'drill' && advisories.length > 0 && (
            <div className="advisory-list">
              <h3>Suggestions</h3>
              <p className="muted tiny">You can still save. These are shop cautions, separate from the red errors.</p>
              <ul>
                {advisories.map((item) => {
                  const adopted = item.adopt ? adoptType(drill, item.adopt) : null
                  return (
                    <li key={item.id}>
                      <p>{item.message}</p>
                      {adopted && item.adopt && (
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => {
                            setDrill(adopted)
                            setDesignId(null)
                          }}
                        >
                          Use {getDrillType(item.adopt).shortLabel}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="btn-row wrap">
            <button type="button" className="btn primary" onClick={handleSave}>
              Save design
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => handleExport('json')}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => handleExport('csv')}
            >
              Export CSV
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => handleExport('sheet')}
            >
              Setup sheet
            </button>
            <button
              type="button"
              className="btn accent"
              disabled={!valid}
              onClick={() => {
                if (!valid) return
                const d = currentAsDesign()
                saveDesign(d)
                setDesignId(d.id)
                refresh()
                onCreateTraveler(d)
              }}
            >
              Create traveler
            </button>
          </div>
          <p className="disclaimer">{DISCLAIMER}</p>
          {message && <p className="toast">{message}</p>}
        </div>
        )}

        {toolType === 'drill' && !wizardOpen && mode === 'beginner' && (
          <DrillTypeCards
            drill={drill}
            setDrill={(next) => {
              setDrill(next)
              setShowAdvanced(false)
            }}
          />
        )}

        <div className="panel">
          <h2>Saved designs</h2>
          {designs.length === 0 && (
            <p className="muted">No saved designs yet.</p>
          )}
          <ul className="list">
            {designs.map((d) => (
              <li key={d.id} className="list-item">
                <div>
                  <strong>{(d.params as { name: string }).name}</strong>
                  <span className="tag">
                    {d.toolType === 'drill'
                      ? getDrillType(normalizeDrill(d.params).drillType).shortLabel
                      : d.toolType}
                  </span>
                  <div className="muted tiny">
                    ⌀{(d.params as { diameter: number }).diameter} mm ·{' '}
                    {(d.params as { fluteCount: number }).fluteCount}F
                  </div>
                </div>
                <div className="btn-row">
                  <button type="button" className="btn sm" onClick={() => handleLoad(d)}>
                    Load
                  </button>
                  <button
                    type="button"
                    className="btn sm danger"
                    onClick={() => handleDelete(d.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="main-stage">
        <ToolPreview toolType={toolType} params={params} highlight={toolType === 'drill' ? highlight : null} />
      </main>

      {showSetupSheet && (
        <SetupSheet
          design={currentAsDesign()}
          onClose={() => setShowSetupSheet(false)}
        />
      )}
    </div>
  )
}

function SetupSheet({
  design,
  onClose,
}: {
  design: SavedDesign
  onClose: () => void
}) {
  const p = design.params as EndmillParams & DrillParams
  return (
    <div className="setup-sheet print-only-block">
      <div className="setup-actions no-print">
        <button type="button" className="btn" onClick={() => window.print()}>
          Print
        </button>
        <button type="button" className="btn ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <article className="setup-doc">
        <header>
          <h1>Tool setup sheet</h1>
          <p className="disclaimer">{DISCLAIMER}</p>
        </header>
        <table>
          <tbody>
            {design.toolType === 'endmill' ? (
              <>
                <tr>
                  <th>Name</th>
                  <td>{p.name}</td>
                  <th>Type</th>
                  <td>endmill</td>
                </tr>
                <tr>
                  <th>Diameter</th>
                  <td>{p.diameter} mm</td>
                  <th>Flutes</th>
                  <td>{p.fluteCount}</td>
                </tr>
                <tr>
                  <th>Helix</th>
                  <td>{(design.params as EndmillParams).helixAngle}°</td>
                  <th>Corner R</th>
                  <td>{(design.params as EndmillParams).cornerRadius} mm</td>
                </tr>
                <tr>
                  <th>Neck ⌀ / L</th>
                  <td colSpan={3}>
                    {(design.params as EndmillParams).neckDiameter ?? '—'} mm /{' '}
                    {(design.params as EndmillParams).neckLength ?? '—'} mm
                  </td>
                </tr>
                <tr>
                  <th>OAL</th>
                  <td>{p.overallLength} mm</td>
                  <th>Flute length</th>
                  <td>{p.fluteLength} mm</td>
                </tr>
                <tr>
                  <th>Shank ⌀ / L</th>
                  <td>
                    {p.shankDiameter} × {p.shankLength} mm
                  </td>
                  <th>Material / coat</th>
                  <td>
                    {p.material} / {p.coating || '—'}
                  </td>
                </tr>
              </>
            ) : (
              snapshotFromDesign(design).lines.map((line) => (
                <tr key={line.label}>
                  <th>{line.label}</th>
                  <td colSpan={3}>{line.value}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <footer>
          <p>Machine: ANCA TGX · Generated by ANCA TGX Studio</p>
        </footer>
      </article>
    </div>
  )
}
