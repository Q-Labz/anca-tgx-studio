import { useCallback, useMemo, useState } from 'react'
import { Designer } from './components/Designer'
import { Traveler } from './components/Traveler'
import { ToolRoomHandoff } from './components/ToolRoomHandoff'
import { GrindSim } from './components/GrindSim'
import type {
  DrillParams,
  EndmillParams,
  SavedDesign,
  ToolType,
} from './lib/types'
import { createDrill, normalizeDrill } from './lib/drillTypes'
import { DEFAULT_ENDMILL } from './lib/types'
import type { GrindMode } from './lib/grindOps'
import { clampStockMm } from './lib/grindOps'
import {
  findPack,
  loadCustomPacks,
  readPackChoice,
  recommendPack,
  saveCustomPacks,
  writePackChoice,
  type WheelPack,
} from './lib/wheelPacks'

type Tab = 'designer' | 'traveler' | 'handoff' | 'grind'

export default function App() {
  const [tab, setTab] = useState<Tab>('designer')
  const [seedDesignId, setSeedDesignId] = useState<string | null>(null)

  // Shared draft so Designer and ToolRoom Handoff stay in sync
  const [toolType, setToolType] = useState<ToolType>('endmill')
  const [endmill, setEndmill] = useState<EndmillParams>({ ...DEFAULT_ENDMILL })
  const [drill, setDrill] = useState<DrillParams>(() => createDrill('jobber'))
  const [designId, setDesignId] = useState<string | null>(null)
  const [grindMode, setGrindMode] = useState<GrindMode>('make')
  const [stockMm, setStockMm] = useState(0.5)
  const [customPacks, setCustomPacks] = useState<WheelPack[]>(() => loadCustomPacks())
  const [packChoice, setPackChoiceState] = useState<string | null>(() => readPackChoice())

  const recommended = useMemo(() => recommendPack(drill), [drill])
  const pack = useMemo(() => {
    if (!packChoice) return recommended.pack
    return findPack(packChoice, customPacks) ?? recommended.pack
  }, [packChoice, customPacks, recommended])

  const setPackChoice = useCallback((id: string | null) => {
    setPackChoiceState(id)
    writePackChoice(id)
  }, [])

  const updateCustomPacks = useCallback((packs: WheelPack[]) => {
    setCustomPacks(packs)
    saveCustomPacks(packs)
  }, [])

  const onCreateTraveler = useCallback((design: SavedDesign) => {
    setSeedDesignId(design.id)
    setTab('traveler')
  }, [])

  const onConsumedSeed = useCallback(() => setSeedDesignId(null), [])

  const loadDesignIntoDraft = useCallback((d: SavedDesign) => {
    setToolType(d.toolType)
    setDesignId(d.id)
    if (d.toolType === 'endmill') setEndmill(d.params as EndmillParams)
    else setDrill(normalizeDrill(d.params))
  }, [])

  return (
    <div className="app">
      <header className="app-header no-print">
        <div className="brand">
          <div className="brand-mark" aria-hidden />
          <div>
            <h1>ANCA TGX Studio</h1>
            <p className="tagline">Cutting tool designer · Grind sim · Job traveler · ToolRoom handoff</p>
          </div>
        </div>
        <nav className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'designer'}
            className={tab === 'designer' ? 'active' : ''}
            onClick={() => setTab('designer')}
          >
            Designer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'grind'}
            className={tab === 'grind' ? 'active' : ''}
            data-testid="tab-grind"
            onClick={() => setTab('grind')}
          >
            Grind sim
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'traveler'}
            className={tab === 'traveler' ? 'active' : ''}
            onClick={() => setTab('traveler')}
          >
            Traveler
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'handoff'}
            className={tab === 'handoff' ? 'active' : ''}
            onClick={() => setTab('handoff')}
          >
            ToolRoom Handoff
          </button>
        </nav>
        <p className="header-disclaimer">
          For ToolRoom / TGX setup — not a TOM file
        </p>
      </header>

      <div className="app-body">
        {tab === 'designer' && (
          <Designer
            toolType={toolType}
            setToolType={setToolType}
            endmill={endmill}
            setEndmill={setEndmill}
            drill={drill}
            setDrill={setDrill}
            designId={designId}
            setDesignId={setDesignId}
            onCreateTraveler={onCreateTraveler}
          />
        )}
        {tab === 'traveler' && (
          <Traveler
            seedDesignId={seedDesignId}
            onConsumedSeed={onConsumedSeed}
            grindMode={grindMode}
            stockMm={stockMm}
            pack={pack}
          />
        )}
        {tab === 'handoff' && (
          <ToolRoomHandoff
            draft={{ toolType, endmill, drill, designId }}
            grindMode={grindMode}
            stockMm={stockMm}
            pack={pack}
            onLoadDesign={loadDesignIntoDraft}
          />
        )}
        {tab === 'grind' && (
          <GrindSim
            toolType={toolType}
            drill={drill}
            mode={grindMode}
            setMode={setGrindMode}
            stockMm={stockMm}
            setStockMm={(mm) => setStockMm(clampStockMm(mm))}
            pack={pack}
            recommended={recommended}
            packChoice={packChoice && findPack(packChoice, customPacks) ? packChoice : null}
            setPackChoice={setPackChoice}
            customPacks={customPacks}
            setCustomPacks={updateCustomPacks}
          />
        )}
      </div>
    </div>
  )
}
