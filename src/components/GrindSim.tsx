import { useEffect, useMemo, useRef, useState } from 'react'
import type { DrillParams, ToolType } from '../lib/types'
import { readExperienceMode, writeExperienceMode, type ExperienceMode } from '../lib/drillGuide'
import { buildGrindPlan } from '../lib/grindPlan'
import { grindVisual, type GrindMode } from '../lib/grindOps'
import { getDrillType } from '../lib/drillTypes'
import { GRIND_DISCLAIMER, type WheelPack } from '../lib/wheelPacks'
import { GrindScene, type CameraPreset } from '../preview/grindScene'
import { WheelPackEditor } from './WheelPackEditor'

interface Props {
  toolType: ToolType
  drill: DrillParams
  mode: GrindMode
  setMode: (mode: GrindMode) => void
  stockMm: number
  setStockMm: (mm: number) => void
  pack: WheelPack
  recommended: { pack: WheelPack; reason: string }
  packChoice: string | null
  setPackChoice: (id: string | null) => void
  customPacks: WheelPack[]
  setCustomPacks: (packs: WheelPack[]) => void
}

const CAMERAS: { id: CameraPreset; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tip', label: 'Tip' },
  { id: 'flute', label: 'Flute' },
  { id: 'wheel', label: 'Wheel contact' },
]

export function GrindSim(props: Props) {
  if (props.toolType !== 'drill') {
    return (
      <div className="panel grind-empty">
        <h2>Grind simulator</h2>
        <p className="banner-warn">{GRIND_DISCLAIMER}</p>
        <p>
          The grind simulator follows the drill open in the Designer. The current tool is a solid endmill, so switch
          the Designer to a drill to run the demonstration.
        </p>
      </div>
    )
  }
  return <DrillGrind {...props} />
}

function DrillGrind({
  drill,
  mode,
  setMode,
  stockMm,
  setStockMm,
  pack,
  recommended,
  packChoice,
  setPackChoice,
  customPacks,
  setCustomPacks,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<GrindScene | null>(null)
  const [scrub, setScrub] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [camera, setCamera] = useState<CameraPreset>('overview')
  const [experience, setExperience] = useState<ExperienceMode>(() => readExperienceMode())

  const plan = useMemo(() => buildGrindPlan(drill, mode, pack, stockMm), [drill, mode, pack, stockMm])
  const visual = useMemo(() => grindVisual(drill, stockMm), [drill, stockMm])
  const geometryKey = [
    drill.drillType,
    drill.diameter,
    drill.fluteLength,
    drill.overallLength,
    drill.pointAngle,
    drill.fluteCount,
    drill.helixAngle,
    drill.shankDiameter,
    drill.shankLength,
    drill.steps.map((step) => `${step.diameter}x${step.length}`).join(','),
    drill.sublandDiameter,
    drill.sublandLength,
    drill.chamferDiameter,
    drill.chamferAngle,
    drill.countersinkDiameter,
    drill.countersinkAngle,
    drill.pilotLength,
    drill.coolantHoles,
    drill.webThinning,
    mode,
    stockMm,
    plan.operations.map((op) => op.stage).join(','),
  ].join('|')
  const wheelKey = plan.operations.map((op) => `${op.id}:${op.wheelId ?? ''}`).join('|')

  const [seenKey, setSeenKey] = useState(geometryKey)
  if (seenKey !== geometryKey) {
    setSeenKey(geometryKey)
    setScrub(0)
    setPlaying(false)
  }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const scene = new GrindScene(mount)
    sceneRef.current = scene
    scene.onProgress = (progress, isPlaying) => {
      setScrub(progress)
      setPlaying(isPlaying)
    }
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    scene.setPlan(
      drill,
      visual,
      plan.initialShow,
      plan.operations.map((op) => ({
        duty: op.duty,
        show: op.show,
        abrasive: pack.wheels.find((wheel) => wheel.id === op.wheelId)?.abrasive ?? null,
      })),
    )
  }, [drill, geometryKey, visual, plan, pack.wheels])

  useEffect(() => {
    sceneRef.current?.setWheels(
      plan.operations.map((op) => ({
        duty: op.duty,
        show: op.show,
        abrasive: pack.wheels.find((wheel) => wheel.id === op.wheelId)?.abrasive ?? null,
      })),
    )
  }, [wheelKey, plan.operations, pack.wheels])

  const count = plan.operations.length
  const finished = scrub >= count - 0.001
  const activeIndex = finished ? count - 1 : Math.min(count - 1, Math.max(0, Math.floor(scrub)))
  const active = plan.operations[activeIndex]

  const jump = (progress: number) => {
    const scene = sceneRef.current
    if (!scene) return
    scene.pause()
    scene.setProgress(progress)
    setScrub(progress)
    setPlaying(false)
  }

  return (
    <div className="tab-layout grind-layout">
      <aside className="sidebar">
        <p className="banner-warn" data-testid="grind-disclaimer">
          {GRIND_DISCLAIMER}
        </p>
        <div className="panel">
          <div className="panel-head">
            <h2>Grind simulator</h2>
            <span className="tag">{getDrillType(drill.drillType).shortLabel}</span>
          </div>
          <div className="seg" role="group" aria-label="Grind mode">
            <button
              type="button"
              className={mode === 'make' ? 'active' : ''}
              data-testid="grind-mode-make"
              onClick={() => setMode('make')}
            >
              Make from blank
            </button>
            <button
              type="button"
              className={mode === 'resharpen' ? 'active' : ''}
              data-testid="grind-mode-resharpen"
              onClick={() => setMode('resharpen')}
            >
              Resharpen
            </button>
          </div>
          {mode === 'resharpen' && (
            <label className="field" style={{ marginTop: '0.7rem' }}>
              <span className="field-label">Length removed (mm)</span>
              <input
                type="number"
                min={0.05}
                max={5}
                step={0.05}
                value={stockMm}
                data-testid="grind-stock"
                onChange={(event) => setStockMm(Number(event.target.value))}
              />
              <span className="muted tiny">How much worn tip this demonstration takes off. Not a feed.</span>
            </label>
          )}
          <div className="grind-controls" role="group" aria-label="Playback">
            <button
              type="button"
              className="btn primary sm"
              data-testid="grind-play"
              onClick={() => {
                const scene = sceneRef.current
                if (!scene) return
                scene.setSpeed(speed)
                scene.play()
                setPlaying(true)
              }}
            >
              {playing ? 'Playing' : 'Play'}
            </button>
            <button
              type="button"
              className="btn sm"
              data-testid="grind-pause"
              onClick={() => {
                sceneRef.current?.pause()
                setPlaying(false)
              }}
            >
              Pause
            </button>
            <button type="button" className="btn sm" data-testid="grind-prev" onClick={() => {
              const current = sceneRef.current?.getProgress() ?? scrub
              jump(Math.max(0, Math.ceil(current - 1.001)))
            }}>
              Previous
            </button>
            <button type="button" className="btn sm" data-testid="grind-next" onClick={() => {
              const current = sceneRef.current?.getProgress() ?? scrub
              jump(Math.min(count, Math.floor(current) + 1))
            }}>
              Next
            </button>
            <label className="field speed-field">
              <span className="field-label">Speed</span>
              <select
                value={String(speed)}
                data-testid="grind-speed"
                onChange={(event) => {
                  const value = Number(event.target.value)
                  setSpeed(value)
                  sceneRef.current?.setSpeed(value)
                }}
              >
                <option value="0.5">0.5×</option>
                <option value="1">1×</option>
                <option value="2">2×</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span className="field-label">
              {finished ? 'Finished' : `Step ${activeIndex + 1} of ${count}`}
            </span>
            <input
              type="range"
              min={0}
              max={count}
              step={0.01}
              value={Math.min(scrub, count)}
              data-testid="grind-scrub"
              onChange={(event) => jump(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="grind-caption" data-testid="grind-caption" aria-live="polite">
          <div className="panel-head">
            <h2>{finished ? 'Sequence finished' : active?.title}</h2>
            <div className="seg" role="group" aria-label="Captions">
              <button
                type="button"
                className={experience === 'beginner' ? 'active' : ''}
                onClick={() => {
                  setExperience('beginner')
                  writeExperienceMode('beginner')
                }}
              >
                Beginner
              </button>
              <button
                type="button"
                className={experience === 'expert' ? 'active' : ''}
                onClick={() => {
                  setExperience('expert')
                  writeExperienceMode('expert')
                }}
              >
                Expert
              </button>
            </div>
          </div>
          {active && (
            <>
              <p>{experience === 'beginner' ? active.narration : active.detail}</p>
              <p className="muted tiny">
                Forms {active.forms}
                {active.wheelName ? ` · ${active.wheelShape} ${active.wheelName}` : ' · no wheel on this step'}
              </p>
              {active.warning && <p className="grind-inline-warn">{active.warning}</p>}
            </>
          )}
        </div>

        <ol className="grind-ops" data-testid="grind-ops">
          {plan.operations.map((op, index) => (
            <li key={op.id}>
              <button
                type="button"
                className={index === activeIndex ? 'active' : ''}
                onClick={() => jump(index)}
              >
                <span className="op-num">{index + 1}</span>
                <span>
                  <strong>{op.title}</strong>
                  <span className="muted tiny">
                    {op.wheelName ? `${op.wheelShape} ${op.wheelName}` : 'No wheel'} · {op.forms}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <main className="main-stage grind-stage">
        <div className="grind-canvas-wrap">
          <div ref={mountRef} className="grind-canvas" data-testid="grind-canvas" />
          <p className="grind-overlay">Approximate geometry. Diameters are drawn thicker than true scale.</p>
        </div>
        <div className="chip-row wrap" role="group" aria-label="Camera">
          {CAMERAS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip ${camera === item.id ? 'active' : ''}`}
              onClick={() => {
                setCamera(item.id)
                sceneRef.current?.setCamera(item.id)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <WheelPackEditor
          drill={drill}
          mode={mode}
          stockMm={stockMm}
          pack={pack}
          recommended={recommended}
          packChoice={packChoice}
          customPacks={customPacks}
          plan={plan}
          onChoose={setPackChoice}
          onCustomPacks={setCustomPacks}
        />
      </main>
    </div>
  )
}
