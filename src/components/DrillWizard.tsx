import { useState } from 'react'
import {
  COOLANT_OPTIONS,
  FEATURE_OPTIONS,
  WORKPIECE_OPTIONS,
  alternativeDrills,
  drillCard,
  recommendDrill,
  workpieceLabel,
  type CoolantAnswer,
  type HoleFeature,
  type WizardAnswers,
  type WorkpieceMaterial,
} from '../lib/drillGuide'
import { getDrillType } from '../lib/drillTypes'
import type { DrillParams } from '../lib/types'

interface Props {
  onCancel: () => void
  onPreview: (drill: DrillParams, workpiece: WorkpieceMaterial) => void
  onAccept: (drill: DrillParams, workpiece: WorkpieceMaterial) => void
}

type WizardStep = 'material' | 'size' | 'feature' | 'coolant' | 'result'

export function DrillWizard({ onCancel, onPreview, onAccept }: Props) {
  const [step, setStep] = useState<WizardStep>('material')
  const [material, setMaterial] = useState<WorkpieceMaterial | null>(null)
  const [diameter, setDiameter] = useState('')
  const [depth, setDepth] = useState('')
  const [feature, setFeature] = useState<HoleFeature | null>(null)
  const [coolant, setCoolant] = useState<CoolantAnswer | null>(null)
  const [picked, setPicked] = useState<DrillParams | null>(null)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState<string[]>([])
  const [problem, setProblem] = useState<string | null>(null)

  const answers = (): WizardAnswers | null => {
    if (!material || !feature || !coolant) return null
    return {
      material,
      feature,
      throughCoolant: coolant,
      diameter: Number(diameter),
      depth: Number(depth),
    }
  }

  const showRecommendation = (next: WizardAnswers, drill: DrillParams, line: string, extra: string[]) => {
    setPicked(drill)
    setReason(line)
    setNotes(extra)
    setProblem(null)
    onPreview(drill, next.material)
    setStep('result')
  }

  const goResult = () => {
    const next = answers()
    if (!next) return
    const result = recommendDrill(next)
    if (!result.ok || !result.drill) {
      setPicked(null)
      setProblem(result.reason)
      setReason('')
      setNotes(result.notes)
      setStep('result')
      return
    }
    showRecommendation(next, result.drill, result.reason, result.notes)
  }

  const pickOther = (drill: DrillParams) => {
    const next = answers()
    if (!next) return
    const card = drillCard(drill.drillType)
    showRecommendation(next, drill, card.forWhat, [card.useWhen])
  }

  const sizeReady = Number(diameter) > 0 && Number(depth) > 0
  const current = answers()
  const others = current && picked ? alternativeDrills(current, picked.drillType) : []

  return (
    <div className="panel wizard">
      <div className="panel-head">
        <h2>Help me choose</h2>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Back to the form
        </button>
      </div>
      <p className="muted tiny">Plain questions. You can change every number after.</p>

      {step === 'material' && (
        <div className="wizard-step">
          <p className="wizard-q">What are you drilling?</p>
          <div className="choice-grid">
            {WORKPIECE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`choice ${material === option.id ? 'active' : ''}`}
                onClick={() => {
                  setMaterial(option.id)
                  setStep('size')
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'size' && (
        <div className="wizard-step">
          <p className="wizard-q">How big is the hole, and how deep?</p>
          <label className="field">
            <span className="field-label">Hole diameter (mm)</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={diameter}
              placeholder="6"
              autoFocus
              onChange={(event) => setDiameter(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Hole depth (mm)</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={depth}
              placeholder="18"
              onChange={(event) => setDepth(event.target.value)}
            />
          </label>
          <div className="btn-row">
            <button type="button" className="btn ghost" onClick={() => setStep('material')}>
              Back
            </button>
            <button type="button" className="btn primary" disabled={!sizeReady} onClick={() => setStep('feature')}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 'feature' && (
        <div className="wizard-step">
          <p className="wizard-q">Does the hole need anything besides a plain point?</p>
          <div className="choice-grid">
            {FEATURE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`choice ${feature === option.id ? 'active' : ''}`}
                onClick={() => {
                  setFeature(option.id)
                  setStep('coolant')
                }}
              >
                <strong>{option.label}</strong>
                <span className="muted tiny">{option.hint}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn ghost" onClick={() => setStep('size')}>
            Back
          </button>
        </div>
      )}

      {step === 'coolant' && (
        <div className="wizard-step">
          <p className="wizard-q">Can the machine push coolant through the tool?</p>
          <div className="choice-grid">
            {COOLANT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`choice ${coolant === option.id ? 'active' : ''}`}
                onClick={() => setCoolant(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="btn-row">
            <button type="button" className="btn ghost" onClick={() => setStep('feature')}>
              Back
            </button>
            <button type="button" className="btn primary" disabled={!coolant} onClick={goResult}>
              Show a recommendation
            </button>
          </div>
        </div>
      )}

      {step === 'result' && (
        <div className="wizard-step">
          {problem && <p className="advisory-text">{problem}</p>}
          {picked && (
            <>
              <p className="wizard-q">{getDrillType(picked.drillType).label}</p>
              <p>{reason}</p>
              <p className="muted tiny">
                {workpieceLabel(material ?? 'unsure')} · ⌀{picked.diameter} mm · {picked.pointAngle}° point · flute{' '}
                {picked.fluteLength} mm
              </p>
              <ul className="note-list">
                {notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <div className="btn-row wrap">
                <button type="button" className="btn primary" onClick={() => onAccept(picked, material ?? 'unsure')}>
                  Use this drill
                </button>
                <button type="button" className="btn ghost" onClick={onCancel}>
                  Keep what I had
                </button>
              </div>
              {others.length > 0 && (
                <>
                  <p className="wizard-q">Or pick something else</p>
                  <div className="choice-grid">
                    {others.map((other) => (
                      <button
                        key={other.drill.drillType}
                        type="button"
                        className="choice"
                        onClick={() => pickOther(other.drill)}
                      >
                        <strong>{getDrillType(other.drill.drillType).shortLabel}</strong>
                        <span className="muted tiny">{other.reason}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          <button type="button" className="btn ghost" onClick={() => setStep('coolant')}>
            Back
          </button>
        </div>
      )}
    </div>
  )
}
