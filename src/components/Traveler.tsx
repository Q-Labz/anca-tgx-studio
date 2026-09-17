import { useEffect, useState, type ReactNode } from 'react'
import type { JobTraveler, SavedDesign, WheelRow } from '../lib/types'
import { makeEmptyTraveler, uid } from '../lib/types'
import {
  deleteTraveler,
  getDesign,
  listDesigns,
  listTravelers,
  saveTraveler,
} from '../lib/storage'
import { DISCLAIMER, exportTravelerJson } from '../lib/export'

interface Props {
  seedDesignId?: string | null
  onConsumedSeed?: () => void
}

export function Traveler({ seedDesignId, onConsumedSeed }: Props) {
  const [traveler, setTraveler] = useState<JobTraveler>(() => makeEmptyTraveler())
  const [saved, setSaved] = useState<JobTraveler[]>(() => listTravelers())
  const [designs] = useState<SavedDesign[]>(() => listDesigns())
  const [message, setMessage] = useState<string | null>(null)
  const [printMode, setPrintMode] = useState(false)

  useEffect(() => {
    if (!seedDesignId) return
    const d = getDesign(seedDesignId)
    if (!d) return
    const p = d.params as { name: string; diameter: number; overallLength: number; material: string }
    setTraveler(
      makeEmptyTraveler({
        designId: d.id,
        designName: p.name,
        toolType: d.toolType,
        blankDiameter: p.diameter,
        blankLength: p.overallLength + 5,
        blankMaterial: p.material === 'HSS' ? 'HSS rod' : 'Carbide rod',
      }),
    )
    onConsumedSeed?.()
    setMessage(`Traveler linked to “${p.name}”`)
    setTimeout(() => setMessage(null), 2500)
  }, [seedDesignId, onConsumedSeed])

  const refresh = () => setSaved(listTravelers())

  const flash = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 2500)
  }

  const patch = (partial: Partial<JobTraveler>) => {
    setTraveler((t) => ({ ...t, ...partial, updatedAt: new Date().toISOString() }))
  }

  const handleSave = () => {
    const next = { ...traveler, updatedAt: new Date().toISOString() }
    saveTraveler(next)
    setTraveler(next)
    refresh()
    flash('Traveler saved')
  }

  const handleLoad = (t: JobTraveler) => {
    setTraveler({
      ...t,
      toolroomTomFilename: t.toolroomTomFilename ?? '',
    })
    flash(`Loaded job ${t.jobNumber || t.id}`)
  }

  const handleDelete = (id: string) => {
    deleteTraveler(id)
    if (traveler.id === id) setTraveler(makeEmptyTraveler())
    refresh()
    flash('Traveler deleted')
  }

  const handleNew = () => {
    setTraveler(makeEmptyTraveler())
    flash('New traveler')
  }

  const linkDesign = (id: string) => {
    if (!id) {
      patch({ designId: null, designName: '', toolType: null })
      return
    }
    const d = getDesign(id)
    if (!d) return
    const p = d.params as { name: string; diameter: number; overallLength: number; material: string }
    patch({
      designId: d.id,
      designName: p.name,
      toolType: d.toolType,
      blankDiameter: p.diameter,
      blankLength: p.overallLength + 5,
      blankMaterial: p.material === 'HSS' ? 'HSS rod' : 'Carbide rod',
    })
  }

  const updateWheel = (id: string, field: keyof WheelRow, value: string) => {
    patch({
      wheels: traveler.wheels.map((w) =>
        w.id === id ? { ...w, [field]: value } : w,
      ),
    })
  }

  const field = (label: string, control: ReactNode) => (
    <label className="field">
      <span className="field-label">{label}</span>
      {control}
    </label>
  )

  return (
    <div className="tab-layout traveler-layout">
      <aside className="sidebar">
        <div className="panel">
          <div className="panel-head">
            <h2>Job traveler</h2>
            <button type="button" className="btn ghost" onClick={handleNew}>
              New
            </button>
          </div>
          <div className="form-grid">
            {field(
              'Linked design',
              <select
                value={traveler.designId ?? ''}
                onChange={(e) => linkDesign(e.target.value)}
              >
                <option value="">— none / manual —</option>
                {designs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {(d.params as { name: string }).name} ({d.toolType})
                  </option>
                ))}
              </select>,
            )}
            {field(
              'Job #',
              <input
                type="text"
                value={traveler.jobNumber}
                onChange={(e) => patch({ jobNumber: e.target.value })}
                placeholder="TGX-2026-001"
              />,
            )}
            {field(
              'Customer / PO (optional)',
              <input
                type="text"
                value={traveler.customerPo}
                onChange={(e) => patch({ customerPo: e.target.value })}
              />,
            )}
            {field(
              'Quantity',
              <input
                type="number"
                min={1}
                step={1}
                value={traveler.quantity}
                onChange={(e) => patch({ quantity: Number(e.target.value) || 1 })}
              />,
            )}
            {field(
              'Date',
              <input
                type="date"
                value={traveler.date}
                onChange={(e) => patch({ date: e.target.value })}
              />,
            )}
            {field(
              'Machine',
              <input
                type="text"
                value={traveler.machine}
                onChange={(e) => patch({ machine: e.target.value })}
              />,
            )}
            {field(
              'Operator',
              <input
                type="text"
                value={traveler.operator}
                onChange={(e) => patch({ operator: e.target.value })}
              />,
            )}
            {field(
              'ToolRoom TOM filename',
              <input
                type="text"
                value={traveler.toolroomTomFilename}
                onChange={(e) => patch({ toolroomTomFilename: e.target.value })}
                placeholder="e.g. EM-10-4F.TOM"
              />,
            )}
          </div>
          <p className="muted tiny" style={{ marginTop: '0.45rem' }}>
            Optional reference only — this app does not create .TOM files.
          </p>
        </div>

        <div className="panel">
          <h2>Blank stock</h2>
          <div className="form-grid cols-2">
            {field(
              'Diameter (mm)',
              <input
                type="number"
                step={0.1}
                value={traveler.blankDiameter}
                onChange={(e) => patch({ blankDiameter: Number(e.target.value) })}
              />,
            )}
            {field(
              'Length (mm)',
              <input
                type="number"
                step={0.1}
                value={traveler.blankLength}
                onChange={(e) => patch({ blankLength: Number(e.target.value) })}
              />,
            )}
            {field(
              'Material',
              <input
                type="text"
                value={traveler.blankMaterial}
                onChange={(e) => patch({ blankMaterial: e.target.value })}
              />,
            )}
            {field(
              'Supplier lot',
              <input
                type="text"
                value={traveler.supplierLot}
                onChange={(e) => patch({ supplierLot: e.target.value })}
              />,
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Wheel pack</h2>
            <button
              type="button"
              className="btn sm"
              onClick={() =>
                patch({
                  wheels: [
                    ...traveler.wheels,
                    { id: uid('wh'), name: '', grit: '', size: '' },
                  ],
                })
              }
            >
              Add wheel
            </button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Grit</th>
                  <th>Size</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {traveler.wheels.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <input
                        value={w.name}
                        onChange={(e) => updateWheel(w.id, 'name', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        value={w.grit}
                        onChange={(e) => updateWheel(w.id, 'grit', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        value={w.size}
                        onChange={(e) => updateWheel(w.id, 'size', e.target.value)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn sm danger"
                        onClick={() =>
                          patch({
                            wheels: traveler.wheels.filter((x) => x.id !== w.id),
                          })
                        }
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="btn-row wrap">
          <button type="button" className="btn primary" onClick={handleSave}>
            Save traveler
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              exportTravelerJson(traveler)
              flash('JSON downloaded')
            }}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="btn accent"
            onClick={() => {
              setPrintMode(true)
              setTimeout(() => window.print(), 80)
            }}
          >
            Print traveler
          </button>
        </div>
        <p className="disclaimer">{DISCLAIMER}</p>
        {message && <p className="toast">{message}</p>}

        <div className="panel">
          <h2>Saved travelers</h2>
          {saved.length === 0 && <p className="muted">None yet.</p>}
          <ul className="list">
            {saved.map((t) => (
              <li key={t.id} className="list-item">
                <div>
                  <strong>{t.jobNumber || 'Untitled job'}</strong>
                  <div className="muted tiny">
                    {t.designName || 'no design'} · qty {t.quantity}
                  </div>
                </div>
                <div className="btn-row">
                  <button type="button" className="btn sm" onClick={() => handleLoad(t)}>
                    Load
                  </button>
                  <button
                    type="button"
                    className="btn sm danger"
                    onClick={() => handleDelete(t.id)}
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
        <div className="panel ops-panel">
          <h2>TGX operation checklist</h2>
          <p className="muted">
            Design: <strong>{traveler.designName || '—'}</strong>
            {traveler.toolType && <span className="tag">{traveler.toolType}</span>}
          </p>
          <ul className="ops-list">
            {traveler.ops.map((op, idx) => (
              <li key={op.id} className={op.done ? 'done' : ''}>
                <label className="op-check">
                  <input
                    type="checkbox"
                    checked={op.done}
                    onChange={(e) =>
                      patch({
                        ops: traveler.ops.map((o) =>
                          o.id === op.id ? { ...o, done: e.target.checked } : o,
                        ),
                      })
                    }
                  />
                  <span className="op-num">{idx + 1}</span>
                  <span className="op-label">{op.label}</span>
                </label>
                <input
                  className="op-notes"
                  type="text"
                  placeholder="Notes…"
                  value={op.notes}
                  onChange={(e) =>
                    patch({
                      ops: traveler.ops.map((o) =>
                        o.id === op.id ? { ...o, notes: e.target.value } : o,
                      ),
                    })
                  }
                />
              </li>
            ))}
          </ul>
          {field(
            'Job notes',
            <textarea
              rows={4}
              value={traveler.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="Setup notes, tolerances, inspection criteria…"
            />,
          )}
        </div>
      </main>

      {printMode && (
        <TravelerPrint
          traveler={traveler}
          onClose={() => setPrintMode(false)}
        />
      )}
    </div>
  )
}

function TravelerPrint({
  traveler,
  onClose,
}: {
  traveler: JobTraveler
  onClose: () => void
}) {
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
          <h1>TGX Job Traveler</h1>
          <p className="disclaimer">{DISCLAIMER}</p>
        </header>
        <table>
          <tbody>
            <tr>
              <th>Job #</th>
              <td>{traveler.jobNumber || '—'}</td>
              <th>Date</th>
              <td>{traveler.date}</td>
            </tr>
            <tr>
              <th>Customer / PO</th>
              <td>{traveler.customerPo || '—'}</td>
              <th>Qty</th>
              <td>{traveler.quantity}</td>
            </tr>
            <tr>
              <th>Design</th>
              <td>
                {traveler.designName || '—'} {traveler.toolType ? `(${traveler.toolType})` : ''}
              </td>
              <th>Machine</th>
              <td>{traveler.machine}</td>
            </tr>
            <tr>
              <th>Operator</th>
              <td colSpan={3}>{traveler.operator || '—'}</td>
            </tr>
            <tr>
              <th>ToolRoom TOM</th>
              <td colSpan={3}>{traveler.toolroomTomFilename || '—'}</td>
            </tr>
            <tr>
              <th>Blank</th>
              <td colSpan={3}>
                ⌀{traveler.blankDiameter} × {traveler.blankLength} mm ·{' '}
                {traveler.blankMaterial}
                {traveler.supplierLot ? ` · lot ${traveler.supplierLot}` : ''}
              </td>
            </tr>
          </tbody>
        </table>
        <h2>Wheel pack</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Grit</th>
              <th>Size</th>
            </tr>
          </thead>
          <tbody>
            {traveler.wheels.map((w) => (
              <tr key={w.id}>
                <td>{w.name}</td>
                <td>{w.grit}</td>
                <td>{w.size}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2>Operations</h2>
        <ol className="print-ops">
          {traveler.ops.map((op) => (
            <li key={op.id}>
              [{op.done ? '✓' : ' '}] {op.label}
              {op.notes ? ` — ${op.notes}` : ''}
            </li>
          ))}
        </ol>
        {traveler.notes && (
          <>
            <h2>Notes</h2>
            <p>{traveler.notes}</p>
          </>
        )}
        <footer>
          <p>ANCA TGX Studio · Not a TOM / ToolRoom binary file</p>
        </footer>
      </article>
    </div>
  )
}
