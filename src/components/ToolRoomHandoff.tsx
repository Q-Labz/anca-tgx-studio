import { useMemo, useState } from 'react'
import type {
  DrillParams,
  EndmillParams,
  SavedDesign,
  ToolType,
} from '../lib/types'
import { listDesigns } from '../lib/storage'
import {
  HANDOFF_DISCLAIMER,
  buildHandoffPayload,
  copyText,
  displayValue,
  exportHandoffJson,
  type HandoffFieldRow,
} from '../lib/toolroomHandoff'

export interface DesignDraft {
  toolType: ToolType
  endmill: EndmillParams
  drill: DrillParams
  designId: string | null
}

interface Props {
  draft: DesignDraft
  onLoadDesign: (d: SavedDesign) => void
}

export function ToolRoomHandoff({ draft, onLoadDesign }: Props) {
  const [designs] = useState<SavedDesign[]>(() => listDesigns())
  const [message, setMessage] = useState<string | null>(null)
  const [showPrint, setShowPrint] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const params = draft.toolType === 'endmill' ? draft.endmill : draft.drill
  const mapping = useMemo(
    () => buildHandoffPayload(draft.toolType, params, draft.designId).mapping,
    [draft.toolType, params, draft.designId],
  )
  const payload = useMemo(
    () => buildHandoffPayload(draft.toolType, params, draft.designId),
    [draft.toolType, params, draft.designId],
  )

  const flash = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 2200)
  }

  const handleCopy = async (row: HandoffFieldRow) => {
    const text = displayValue(row)
    const ok = await copyText(text)
    if (ok) {
      setCopiedKey(row.studioKey)
      setTimeout(() => setCopiedKey(null), 1200)
      flash(`Copied ${row.studioLabel}`)
    } else {
      flash('Copy failed — select the value manually')
    }
  }

  const handleCopyAll = async () => {
    const lines = mapping.map(
      (r) => `${r.toolRoomLabel}\t${displayValue(r)}\t(studio: ${r.studioKey})`,
    )
    const ok = await copyText(lines.join('\n'))
    flash(ok ? 'All rows copied (TSV)' : 'Copy failed')
  }

  return (
    <div className="tab-layout handoff-layout">
      <aside className="sidebar">
        <div className="panel">
          <h2>Source design</h2>
          <p className="muted tiny">
            Uses the current Designer form, or load a saved design below.
          </p>
          <div className="handoff-source">
            <div>
              <strong>{(params as { name: string }).name || 'Untitled'}</strong>
              <span className="tag">{draft.toolType}</span>
            </div>
            <div className="muted tiny">
              {draft.designId ? `Saved id: ${draft.designId}` : 'Unsaved draft (current form)'}
            </div>
          </div>
          <label className="field" style={{ marginTop: '0.65rem' }}>
            <span className="field-label">Load saved design into form</span>
            <select
              defaultValue=""
              onChange={(e) => {
                const id = e.target.value
                if (!id) return
                const d = designs.find((x) => x.id === id)
                if (d) {
                  onLoadDesign(d)
                  flash(`Loaded “${(d.params as { name: string }).name}”`)
                }
                e.target.value = ''
              }}
            >
              <option value="">— select to load —</option>
              {designs.map((d) => (
                <option key={d.id} value={d.id}>
                  {(d.params as { name: string }).name} ({d.toolType})
                </option>
              ))}
            </select>
          </label>
          {designs.length === 0 && (
            <p className="muted tiny">No saved designs — edit in Designer first.</p>
          )}
        </div>

        <div className="panel">
          <h2>Exports</h2>
          <div className="btn-row wrap" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                exportHandoffJson(payload)
                flash('Handoff JSON downloaded')
              }}
            >
              Download JSON
            </button>
            <button
              type="button"
              className="btn accent"
              onClick={() => {
                setShowPrint(true)
                setTimeout(() => window.print(), 80)
              }}
            >
              Print handoff sheet
            </button>
            <button type="button" className="btn" onClick={handleCopyAll}>
              Copy all rows
            </button>
            <a
              className="btn"
              href="/toolroom-script-skeleton.txt"
              download="toolroom-script-skeleton.txt"
            >
              Download script skeleton
            </a>
          </div>
          <p className="muted tiny" style={{ marginTop: '0.65rem' }}>
            Schema <code>toolroomHandoff</code> v{payload.schemaVersion}. Script
            skeleton is a template only — adapt param IDs via ANCA docs / Club.
          </p>
          {message && <p className="toast">{message}</p>}
        </div>

        <div className="panel">
          <h2>Safe workflow</h2>
          <ol className="workflow-list">
            <li>Map / enter params in ToolRoom iGrind (manual or adapted script)</li>
            <li>ToolRoom saves the real <strong>.TOM</strong></li>
            <li>Verify in <strong>CIM3D</strong></li>
            <li>Grind on <strong>TGX</strong> (confirm software generation with ANCA)</li>
          </ol>
        </div>
      </aside>

      <main className="main-stage">
        <div className="banner-warn" role="status">
          <strong>Disclaimer:</strong> {HANDOFF_DISCLAIMER}
        </div>

        <div className="panel handoff-map-panel">
          <div className="panel-head">
            <h2>
              Field map · {draft.toolType === 'endmill' ? 'Solid endmill' : 'Drill'}
            </h2>
            <span className="muted tiny">Studio → typical ToolRoom iGrind labels</span>
          </div>
          <div className="table-wrap">
            <table className="handoff-table">
              <thead>
                <tr>
                  <th>Studio value</th>
                  <th>ToolRoom field (typical)</th>
                  <th>Studio key</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {mapping.map((row) => (
                  <tr key={row.studioKey}>
                    <td>
                      <span className="handoff-value">{displayValue(row)}</span>
                      <div className="muted tiny">{row.studioLabel}</div>
                    </td>
                    <td>{row.toolRoomLabel}</td>
                    <td>
                      <code>{row.studioKey}</code>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => handleCopy(row)}
                        title="Copy value"
                      >
                        {copiedKey === row.studioKey ? 'Copied' : 'Copy'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted tiny" style={{ marginTop: '0.75rem' }}>
            Labels are typical iGrind / ToolRoom names and may differ by RN. Confirm
            against your release. Neck rows appear only when neck values are set.
          </p>
        </div>
      </main>

      {showPrint && (
        <HandoffPrintSheet
          payload={payload}
          mapping={mapping}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}

function HandoffPrintSheet({
  payload,
  mapping,
  onClose,
}: {
  payload: ReturnType<typeof buildHandoffPayload>
  mapping: HandoffFieldRow[]
  onClose: () => void
}) {
  const name =
    (typeof payload.fields.name === 'string' && payload.fields.name) || 'Tool'
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
          <h1>ToolRoom Handoff Sheet</h1>
          <p className="disclaimer">{HANDOFF_DISCLAIMER}</p>
        </header>
        <p>
          <strong>{name}</strong> · {payload.toolType} · schema{' '}
          {payload.schema} v{payload.schemaVersion}
        </p>
        <table>
          <thead>
            <tr>
              <th>Studio value</th>
              <th>ToolRoom field (typical)</th>
              <th>Studio key</th>
            </tr>
          </thead>
          <tbody>
            {mapping.map((row) => (
              <tr key={row.studioKey}>
                <td>{displayValue(row)}</td>
                <td>{row.toolRoomLabel}</td>
                <td>{row.studioKey}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2>Checklist</h2>
        <ol className="print-ops">
          <li>Enter values in ToolRoom iGrind (or run an adapted script)</li>
          <li>Save .TOM in ToolRoom</li>
          <li>Verify in CIM3D</li>
          <li>Confirm TGX software generation with ANCA before grind</li>
        </ol>
        <footer>
          <p>
            ANCA TGX Studio · Does not write TOM files · Generated{' '}
            {new Date(payload.generatedAt).toLocaleString()}
          </p>
        </footer>
      </article>
    </div>
  )
}
