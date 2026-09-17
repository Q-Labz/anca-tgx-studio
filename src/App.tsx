import { useCallback, useState } from 'react'
import { Designer } from './components/Designer'
import { Traveler } from './components/Traveler'
import { ToolRoomHandoff } from './components/ToolRoomHandoff'
import type {
  DrillParams,
  EndmillParams,
  SavedDesign,
  ToolType,
} from './lib/types'
import { DEFAULT_DRILL, DEFAULT_ENDMILL } from './lib/types'

type Tab = 'designer' | 'traveler' | 'handoff'

export default function App() {
  const [tab, setTab] = useState<Tab>('designer')
  const [seedDesignId, setSeedDesignId] = useState<string | null>(null)

  // Shared draft so Designer and ToolRoom Handoff stay in sync
  const [toolType, setToolType] = useState<ToolType>('endmill')
  const [endmill, setEndmill] = useState<EndmillParams>({ ...DEFAULT_ENDMILL })
  const [drill, setDrill] = useState<DrillParams>({ ...DEFAULT_DRILL })
  const [designId, setDesignId] = useState<string | null>(null)

  const onCreateTraveler = useCallback((design: SavedDesign) => {
    setSeedDesignId(design.id)
    setTab('traveler')
  }, [])

  const onConsumedSeed = useCallback(() => setSeedDesignId(null), [])

  const loadDesignIntoDraft = useCallback((d: SavedDesign) => {
    setToolType(d.toolType)
    setDesignId(d.id)
    if (d.toolType === 'endmill') setEndmill(d.params as EndmillParams)
    else setDrill(d.params as DrillParams)
  }, [])

  return (
    <div className="app">
      <header className="app-header no-print">
        <div className="brand">
          <div className="brand-mark" aria-hidden />
          <div>
            <h1>ANCA TGX Studio</h1>
            <p className="tagline">Cutting tool designer · Job traveler · ToolRoom handoff</p>
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
          <Traveler seedDesignId={seedDesignId} onConsumedSeed={onConsumedSeed} />
        )}
        {tab === 'handoff' && (
          <ToolRoomHandoff
            draft={{ toolType, endmill, drill, designId }}
            onLoadDesign={loadDesignIntoDraft}
          />
        )}
      </div>
    </div>
  )
}
