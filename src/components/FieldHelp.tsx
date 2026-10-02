import { useState } from 'react'
import type { DiagramKind, FieldHelpEntry } from '../lib/drillGuide'

function HelpDiagram({ kind }: { kind: DiagramKind }) {
  const stroke = '#8fd9cf'
  const dim = '#8a9ba8'
  switch (kind) {
    case 'none':
      return null
    case 'diameter':
      return (
        <svg className="help-diagram" viewBox="0 0 88 48" aria-hidden>
          <path d="M18 10 h52 l-8 28 h-36 z" fill="none" stroke={stroke} strokeWidth="1.6" />
          <path d="M30 24 h28" stroke={dim} strokeWidth="1.2" />
          <path d="M30 21 v6 M58 21 v6" stroke={dim} strokeWidth="1.2" />
        </svg>
      )
    case 'point':
      return (
        <svg className="help-diagram" viewBox="0 0 88 48" aria-hidden>
          <path d="M44 38 L28 12 h32 z" fill="none" stroke={stroke} strokeWidth="1.6" />
          <path d="M36 18 a14 14 0 0 0 16 0" fill="none" stroke={dim} strokeWidth="1.2" />
        </svg>
      )
    case 'flute':
      return (
        <svg className="help-diagram" viewBox="0 0 88 48" aria-hidden>
          <rect x="34" y="6" width="20" height="36" rx="2" fill="none" stroke={stroke} strokeWidth="1.6" />
          <path d="M38 8 c6 8 6 12 0 20 s-6 12 0 16" fill="none" stroke={dim} strokeWidth="1.2" />
        </svg>
      )
    case 'shank':
      return (
        <svg className="help-diagram" viewBox="0 0 88 48" aria-hidden>
          <path d="M18 30 L30 18 h20 v12 h20 v8 H18 z" fill="none" stroke={stroke} strokeWidth="1.6" />
          <path d="M50 18 v12" stroke={dim} strokeWidth="1.2" />
        </svg>
      )
    case 'web':
      return (
        <svg className="help-diagram" viewBox="0 0 88 48" aria-hidden>
          <circle cx="44" cy="24" r="14" fill="none" stroke={stroke} strokeWidth="1.6" />
          <path d="M32 24 h20" stroke={dim} strokeWidth="3" strokeLinecap="round" />
        </svg>
      )
    case 'helix':
      return (
        <svg className="help-diagram" viewBox="0 0 88 48" aria-hidden>
          <rect x="36" y="6" width="16" height="36" fill="none" stroke={stroke} strokeWidth="1.6" />
          <path d="M38 10 c10 6 10 10 0 16 s-10 10 0 16" fill="none" stroke={dim} strokeWidth="1.2" />
        </svg>
      )
    case 'margin':
      return (
        <svg className="help-diagram" viewBox="0 0 88 48" aria-hidden>
          <circle cx="44" cy="24" r="14" fill="none" stroke={stroke} strokeWidth="1.6" />
          <path d="M44 10 a14 14 0 0 1 0 28" fill="none" stroke={dim} strokeWidth="3" />
        </svg>
      )
    case 'coolant':
      return (
        <svg className="help-diagram" viewBox="0 0 88 48" aria-hidden>
          <circle cx="44" cy="24" r="14" fill="none" stroke={stroke} strokeWidth="1.6" />
          <circle cx="38" cy="24" r="2.2" fill={dim} />
          <circle cx="50" cy="24" r="2.2" fill={dim} />
        </svg>
      )
    case 'step':
      return (
        <svg className="help-diagram" viewBox="0 0 88 48" aria-hidden>
          <path d="M16 34 h16 v-8 h16 v-8 h16 v16 H16 z" fill="none" stroke={stroke} strokeWidth="1.6" />
        </svg>
      )
    case 'chamfer':
      return (
        <svg className="help-diagram" viewBox="0 0 88 48" aria-hidden>
          <path d="M24 34 h12 l10-16 h20 v16 H24 z" fill="none" stroke={stroke} strokeWidth="1.6" />
        </svg>
      )
    default: {
      const exhaustive: never = kind
      return exhaustive
    }
  }
}

export function FieldHelp({ help }: { help: FieldHelpEntry }) {
  const [pinned, setPinned] = useState(false)
  return (
    <span className={`field-help${pinned ? ' pinned' : ''}`}>
      <button
        type="button"
        className="help-btn"
        aria-expanded={pinned}
        aria-label={help.text}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setPinned((open) => !open)
        }}
      >
        ?
      </button>
      <span className="field-help-pop" role="tooltip">
        <HelpDiagram kind={help.diagram} />
        <span>{help.text}</span>
      </span>
    </span>
  )
}
