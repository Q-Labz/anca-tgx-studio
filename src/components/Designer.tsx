import { useMemo, useState, type ReactNode } from 'react'
import type {
  DrillParams,
  EndmillParams,
  SavedDesign,
  ToolMaterial,
  ToolType,
} from '../lib/types'
import {
  DEFAULT_DRILL,
  DEFAULT_ENDMILL,
  uid,
} from '../lib/types'
import { deleteDesign, listDesigns, saveDesign } from '../lib/storage'
import { validateTool } from '../lib/validation'
import { DISCLAIMER, exportDesignCsv, exportDesignJson } from '../lib/export'
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

  const params = toolType === 'endmill' ? endmill : drill
  const errors = useMemo(() => validateTool(toolType, params), [toolType, params])
  const valid = Object.keys(errors).length === 0

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
    else setDrill(d.params as DrillParams)
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
    if (toolType === 'endmill') setEndmill({ ...DEFAULT_ENDMILL })
    else setDrill({ ...DEFAULT_DRILL })
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

        <div className="panel form-panel">
          <h2>Parameters</h2>
          <div className="form-grid">
            {field(
              'name',
              'Name',
              <input
                type="text"
                value={params.name}
                onChange={(e) =>
                  toolType === 'endmill'
                    ? setEndmill({ ...endmill, name: e.target.value })
                    : setDrill({ ...drill, name: e.target.value })
                }
              />,
            )}
            {field(
              'diameter',
              'Diameter (mm)',
              num(params.diameter, (n) =>
                toolType === 'endmill'
                  ? setEndmill({ ...endmill, diameter: n ?? 0 })
                  : setDrill({ ...drill, diameter: n ?? 0 }),
              ),
            )}
            {field(
              'fluteCount',
              'Flute count',
              <input
                type="number"
                min={toolType === 'endmill' ? 2 : 2}
                max={toolType === 'endmill' ? 8 : 3}
                step={1}
                value={params.fluteCount}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  toolType === 'endmill'
                    ? setEndmill({ ...endmill, fluteCount: n })
                    : setDrill({ ...drill, fluteCount: n })
                }}
              />,
            )}
            {toolType === 'endmill' &&
              field(
                'helixAngle',
                'Helix angle (°)',
                num(endmill.helixAngle, (n) =>
                  setEndmill({ ...endmill, helixAngle: n ?? 0 }),
                ),
              )}
            {toolType === 'drill' &&
              field(
                'pointAngle',
                'Point angle (°)',
                <div className="inline-row">
                  {num(drill.pointAngle, (n) =>
                    setDrill({ ...drill, pointAngle: n ?? 118 }),
                  )}
                  <div className="chip-row">
                    {[118, 135].map((a) => (
                      <button
                        key={a}
                        type="button"
                        className={`chip ${drill.pointAngle === a ? 'active' : ''}`}
                        onClick={() => setDrill({ ...drill, pointAngle: a })}
                      >
                        {a}°
                      </button>
                    ))}
                  </div>
                </div>,
              )}
            {field(
              'overallLength',
              'Overall length (mm)',
              num(params.overallLength, (n) =>
                toolType === 'endmill'
                  ? setEndmill({ ...endmill, overallLength: n ?? 0 })
                  : setDrill({ ...drill, overallLength: n ?? 0 }),
              ),
            )}
            {field(
              'fluteLength',
              'Flute length (mm)',
              num(params.fluteLength, (n) =>
                toolType === 'endmill'
                  ? setEndmill({ ...endmill, fluteLength: n ?? 0 })
                  : setDrill({ ...drill, fluteLength: n ?? 0 }),
              ),
            )}
            {field(
              'shankDiameter',
              'Shank diameter (mm)',
              num(params.shankDiameter, (n) =>
                toolType === 'endmill'
                  ? setEndmill({ ...endmill, shankDiameter: n ?? 0 })
                  : setDrill({ ...drill, shankDiameter: n ?? 0 }),
              ),
            )}
            {field(
              'shankLength',
              'Shank length (mm)',
              num(params.shankLength, (n) =>
                toolType === 'endmill'
                  ? setEndmill({ ...endmill, shankLength: n ?? 0 })
                  : setDrill({ ...drill, shankLength: n ?? 0 }),
              ),
            )}
            {toolType === 'endmill' && (
              <>
                {field(
                  'cornerRadius',
                  'Corner radius (mm, 0 = square)',
                  num(endmill.cornerRadius, (n) =>
                    setEndmill({ ...endmill, cornerRadius: n ?? 0 }),
                  ),
                )}
                {field(
                  'neckDiameter',
                  'Neck diameter (optional)',
                  num(
                    endmill.neckDiameter,
                    (n) => setEndmill({ ...endmill, neckDiameter: n }),
                    { nullable: true },
                  ),
                )}
                {field(
                  'neckLength',
                  'Neck length (optional)',
                  num(
                    endmill.neckLength,
                    (n) => setEndmill({ ...endmill, neckLength: n }),
                    { nullable: true },
                  ),
                )}
              </>
            )}
            {toolType === 'drill' &&
              field(
                'webThinningNote',
                'Web thinning note',
                <input
                  type="text"
                  value={drill.webThinningNote}
                  placeholder="e.g. split point / thinned"
                  onChange={(e) =>
                    setDrill({ ...drill, webThinningNote: e.target.value })
                  }
                />,
              )}
            {field(
              'coating',
              'Coating',
              <input
                type="text"
                value={params.coating}
                onChange={(e) =>
                  toolType === 'endmill'
                    ? setEndmill({ ...endmill, coating: e.target.value })
                    : setDrill({ ...drill, coating: e.target.value })
                }
              />,
            )}
            {field(
              'material',
              'Material',
              <select
                value={params.material}
                onChange={(e) => {
                  const m = e.target.value as ToolMaterial
                  toolType === 'endmill'
                    ? setEndmill({ ...endmill, material: m })
                    : setDrill({ ...drill, material: m })
                }}
              >
                <option value="carbide">Carbide</option>
                <option value="HSS">HSS</option>
              </select>,
            )}
          </div>

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
                  <span className="tag">{d.toolType}</span>
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
        <ToolPreview toolType={toolType} params={params} />
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
            <tr>
              <th>Name</th>
              <td>{p.name}</td>
              <th>Type</th>
              <td>{design.toolType}</td>
            </tr>
            <tr>
              <th>Diameter</th>
              <td>{p.diameter} mm</td>
              <th>Flutes</th>
              <td>{p.fluteCount}</td>
            </tr>
            {design.toolType === 'endmill' ? (
              <>
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
              </>
            ) : (
              <>
                <tr>
                  <th>Point angle</th>
                  <td>{(design.params as DrillParams).pointAngle}°</td>
                  <th>Web thinning</th>
                  <td>{(design.params as DrillParams).webThinningNote || '—'}</td>
                </tr>
              </>
            )}
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
          </tbody>
        </table>
        <footer>
          <p>Machine: ANCA TGX · Generated by ANCA TGX Studio</p>
        </footer>
      </article>
    </div>
  )
}
