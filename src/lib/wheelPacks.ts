import type { DrillParams } from './types'

/** ISO-style wheel shapes. Generic labels — not ANCA part numbers. */
export const WHEEL_SHAPES = ['1A1', '1V1', '11V9', '12V9'] as const
export type WheelShape = (typeof WHEEL_SHAPES)[number]

export const ABRASIVES = ['diamond', 'cbn'] as const
export type Abrasive = (typeof ABRASIVES)[number]

export const GRIT_LABELS = ['coarse', 'medium', 'fine'] as const
export type GritLabel = (typeof GRIT_LABELS)[number]

/** What a wheel is allowed to do. A shop inventory sets this explicitly. */
export const WHEEL_DUTIES = ['od', 'flute', 'clearance', 'gash', 'point', 'chamfer'] as const
export type WheelDuty = (typeof WHEEL_DUTIES)[number]

export const WHEEL_CATALOG_SCHEMA = 'tgxStudioWheelCatalog' as const
export const WHEEL_CATALOG_SCHEMA_VERSION = 1 as const

export const CUSTOM_PACKS_KEY = 'anca-tgx-studio:custom-wheel-packs'
export const PACK_CHOICE_KEY = 'anca-tgx-studio:wheel-pack-id'

export const GRIND_DISCLAIMER =
  'Educational approximation of a 5-axis tool grind. Not ANCA’s simulation, not CIM3D, and not a .TOM. Wheels are generic shapes and abrasive labels — not ANCA part numbers — and this view does not show speeds or feeds.'

export interface CatalogWheel {
  id: string
  name: string
  shape: WheelShape
  diameterMm: number
  widthMm: number
  abrasive: Abrasive
  grit: GritLabel
  duties: WheelDuty[]
}

export interface WheelPack {
  id: string
  name: string
  notes: string
  source: 'catalog' | 'custom'
  wheels: CatalogWheel[]
}

export interface WheelCatalogFile {
  schema: typeof WHEEL_CATALOG_SCHEMA
  schemaVersion: typeof WHEEL_CATALOG_SCHEMA_VERSION
  packs: WheelPack[]
}

function wheel(
  id: string,
  name: string,
  shape: WheelShape,
  diameterMm: number,
  widthMm: number,
  abrasive: Abrasive,
  grit: GritLabel,
  duties: WheelDuty[],
): CatalogWheel {
  return { id, name, shape, diameterMm, widthMm, abrasive, grit, duties }
}

function pack(id: string, name: string, notes: string, wheels: CatalogWheel[]): WheelPack {
  return { id, name, notes, source: 'catalog', wheels }
}

export const CATALOG_PACKS: readonly WheelPack[] = [
  pack(
    'twist-carbide',
    'Twist carbide — general',
    'Sample diamond wheels for a carbide twist drill. Replace this pack with the shop’s own inventory.',
    [
      wheel('twist-od', 'Straight OD wheel', '1A1', 125, 10, 'diamond', 'medium', ['od', 'clearance']),
      wheel('twist-flute', 'Flute wheel', '1A1', 100, 10, 'diamond', 'medium', ['flute']),
      wheel('twist-gash', 'Flared gash wheel', '1V1', 100, 6, 'diamond', 'fine', ['gash', 'flute']),
      wheel('twist-point', 'Cup point wheel', '11V9', 100, 3, 'diamond', 'fine', ['point']),
    ],
  ),
  pack(
    'micro-carbide',
    'Micro carbide',
    'Smaller sample diamond wheels for micro and small-diameter carbide drills.',
    [
      wheel('micro-od', 'Small straight wheel', '1A1', 75, 6, 'diamond', 'fine', ['od', 'clearance']),
      wheel('micro-flute', 'Small flute wheel', '1A1', 75, 6, 'diamond', 'fine', ['flute']),
      wheel('micro-gash', 'Small flared wheel', '1V1', 75, 3, 'diamond', 'fine', ['gash', 'flute']),
      wheel('micro-point', 'Small cup wheel', '11V9', 75, 3, 'diamond', 'fine', ['point']),
    ],
  ),
  pack(
    'step-carbide',
    'Step and chamfer carbide',
    'Twist wheels plus a dish wheel for shoulders, chamfers, and countersinks.',
    [
      wheel('step-od', 'Straight OD wheel', '1A1', 125, 10, 'diamond', 'medium', ['od', 'clearance']),
      wheel('step-flute', 'Flute wheel', '1A1', 100, 10, 'diamond', 'medium', ['flute']),
      wheel('step-gash', 'Flared gash wheel', '1V1', 100, 6, 'diamond', 'fine', ['gash', 'flute']),
      wheel('step-point', 'Cup point wheel', '11V9', 100, 3, 'diamond', 'fine', ['point']),
      wheel('step-dish', 'Dish wheel', '12V9', 100, 3, 'diamond', 'fine', ['chamfer', 'point']),
    ],
  ),
  pack(
    'gun-carbide',
    'Gun drill carbide',
    'Straight and cup wheels for a gun-drill head. No gash wheel — a gun drill is not web-thinned like a twist drill.',
    [
      wheel('gun-od', 'Straight head wheel', '1A1', 125, 10, 'diamond', 'medium', ['od', 'clearance']),
      wheel('gun-flute', 'Straight flute wheel', '1A1', 100, 10, 'diamond', 'medium', ['flute']),
      wheel('gun-point', 'Cup point wheel', '11V9', 100, 3, 'diamond', 'fine', ['point']),
    ],
  ),
  pack(
    'hss-resharpen',
    'HSS — CBN',
    'Sample CBN wheels. CBN is the usual abrasive for high-speed steel; diamond is the usual abrasive for carbide. Generic labels only.',
    [
      wheel('hss-od', 'CBN straight wheel', '1A1', 125, 10, 'cbn', 'medium', ['od', 'flute', 'clearance']),
      wheel('hss-gash', 'CBN flared wheel', '1V1', 100, 6, 'cbn', 'fine', ['gash', 'flute']),
      wheel('hss-point', 'CBN cup wheel', '11V9', 100, 3, 'cbn', 'fine', ['point']),
      wheel('hss-dish', 'CBN dish wheel', '12V9', 100, 3, 'cbn', 'fine', ['chamfer', 'point']),
    ],
  ),
]

const CATALOG_IDS = new Set(CATALOG_PACKS.map((item) => item.id))

export function shapeLabel(shape: WheelShape): string {
  switch (shape) {
    case '1A1':
      return '1A1 straight'
    case '1V1':
      return '1V1 flared'
    case '11V9':
      return '11V9 flaring cup'
    case '12V9':
      return '12V9 dish'
    default: {
      const neverShape: never = shape
      return neverShape
    }
  }
}

export function dutyLabel(duty: WheelDuty): string {
  switch (duty) {
    case 'od':
      return 'OD / cylindrical'
    case 'flute':
      return 'Fluting'
    case 'clearance':
      return 'Clearance / back taper'
    case 'gash':
      return 'Gashing / web thinning'
    case 'point':
      return 'Point and relief'
    case 'chamfer':
      return 'Step, chamfer, or dish'
    default: {
      const neverDuty: never = duty
      return neverDuty
    }
  }
}

export function abrasiveLabel(abrasive: Abrasive): string {
  switch (abrasive) {
    case 'diamond':
      return 'diamond'
    case 'cbn':
      return 'CBN'
    default: {
      const neverAbrasive: never = abrasive
      return neverAbrasive
    }
  }
}

export function defaultDuties(shape: WheelShape): WheelDuty[] {
  switch (shape) {
    case '1A1':
      return ['od', 'flute', 'clearance']
    case '1V1':
      return ['flute', 'gash']
    case '11V9':
      return ['point', 'gash', 'chamfer']
    case '12V9':
      return ['point', 'chamfer']
    default: {
      const neverShape: never = shape
      return neverShape
    }
  }
}

export function missingDutyWarning(duty: WheelDuty): string {
  switch (duty) {
    case 'gash':
      return 'This pack has no wheel marked for gashing. Web thinning cannot be ground with this pack.'
    case 'chamfer':
      return 'This pack has no dish or cup marked for steps and chamfers. Shoulders cannot be ground with this pack.'
    case 'point':
      return 'This pack has no wheel marked for the point. Point and relief cannot be ground with this pack.'
    case 'flute':
      return 'This pack has no wheel marked for fluting. Flutes cannot be ground with this pack.'
    case 'od':
      return 'This pack has no wheel marked for cylindrical grinding. The diameter cannot be ground with this pack.'
    case 'clearance':
      return 'This pack has no wheel marked for body clearance. Margin and back taper cannot be ground with this pack.'
    default: {
      const neverDuty: never = duty
      return neverDuty
    }
  }
}

export function wheelForDuty(pack: WheelPack, duty: WheelDuty): CatalogWheel | null {
  return pack.wheels.find((item) => item.duties.includes(duty)) ?? null
}

export function formatWheelSize(wheelItem: CatalogWheel): string {
  return `${wheelItem.shape} · ${wheelItem.diameterMm}×${wheelItem.widthMm} mm · ${abrasiveLabel(wheelItem.abrasive)} · ${wheelItem.grit}`
}

export function clonePack(source: WheelPack): WheelPack {
  return {
    ...source,
    wheels: source.wheels.map((item) => ({ ...item, duties: [...item.duties] })),
  }
}

export function blankCustomPack(): WheelPack {
  const stamp = Date.now().toString(36)
  return {
    id: `custom-${stamp}`,
    name: 'Shop pack',
    notes: 'Generic wheels entered in the studio. Not an ANCA part list.',
    source: 'custom',
    wheels: [
      {
        id: `wheel-${stamp}`,
        name: 'Straight wheel',
        shape: '1A1',
        diameterMm: 100,
        widthMm: 10,
        abrasive: 'diamond',
        grit: 'medium',
        duties: defaultDuties('1A1'),
      },
    ],
  }
}

function catalogById(id: string): WheelPack | null {
  return CATALOG_PACKS.find((item) => item.id === id) ?? null
}

export function findPack(id: string, custom: readonly WheelPack[] = []): WheelPack | null {
  return custom.find((item) => item.id === id) ?? catalogById(id)
}

export function recommendPack(drill: DrillParams): { pack: WheelPack; reason: string } {
  const hss = catalogById('hss-resharpen')
  const gun = catalogById('gun-carbide')
  const step = catalogById('step-carbide')
  const micro = catalogById('micro-carbide')
  const twist = catalogById('twist-carbide')
  if (!hss || !gun || !step || !micro || !twist) {
    throw new Error('Sample wheel catalog is missing a pack')
  }

  if (drill.material === 'HSS') {
    return {
      pack: hss,
      reason:
        'This drill is HSS, so the sample pack uses CBN. CBN is the usual abrasive for high-speed steel. Diamond is the usual abrasive for carbide. These are generic labels, not catalog numbers.',
    }
  }

  switch (drill.drillType) {
    case 'gun':
      return {
        pack: gun,
        reason:
          'A gun drill needs a straight wheel for the head and the straight flute, and a cup wheel for the point. This sample pack has no gash wheel, because a gun drill is not thinned like a twist drill.',
      }
    case 'step':
    case 'countersink':
    case 'center':
    case 'subland':
      return {
        pack: step,
        reason:
          'This drill has a shoulder, chamfer, or countersink, so the sample pack adds a dish wheel beside the usual twist wheels.',
      }
    case 'micro':
      return {
        pack: micro,
        reason: 'Micro drills use the smaller sample wheels so the contact stays in scale with the tool.',
      }
    case 'jobber':
    case 'stub':
    case 'taper':
    case 'spot90':
    case 'spot120':
    case 'coolant':
    case 'parabolic':
    case 'straight':
    case 'flat-bottom':
    case 'core':
    case 'double-margin':
      if (drill.diameter <= 3) {
        return {
          pack: micro,
          reason: `At ${drill.diameter} mm the smaller sample wheels are a better fit than the general twist pack.`,
        }
      }
      return {
        pack: twist,
        reason: `Carbide ${drill.drillType.replace('-', ' ')} at ${drill.diameter} mm uses the general twist pack: a straight wheel for the diameter, a flute wheel, a flared wheel for the web, and a cup wheel for the point.`,
      }
    default: {
      const neverType: never = drill.drillType
      return { pack: twist, reason: neverType }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isShape(value: unknown): value is WheelShape {
  return typeof value === 'string' && (WHEEL_SHAPES as readonly string[]).includes(value)
}

function isAbrasive(value: unknown): value is Abrasive {
  return value === 'diamond' || value === 'cbn'
}

function isGrit(value: unknown): value is GritLabel {
  return value === 'coarse' || value === 'medium' || value === 'fine'
}

function isDuty(value: unknown): value is WheelDuty {
  return typeof value === 'string' && (WHEEL_DUTIES as readonly string[]).includes(value)
}

export function validateWheel(wheelItem: CatalogWheel): string | null {
  if (!wheelItem.id.trim()) return 'Each wheel needs an id.'
  if (!wheelItem.name.trim()) return 'Each wheel needs a name.'
  if (!isShape(wheelItem.shape)) return 'Wheel shape must be 1A1, 1V1, 11V9, or 12V9.'
  if (!Number.isFinite(wheelItem.diameterMm) || wheelItem.diameterMm <= 0) {
    return 'Wheel diameter must be a positive number of millimetres.'
  }
  if (!Number.isFinite(wheelItem.widthMm) || wheelItem.widthMm <= 0) {
    return 'Wheel width must be a positive number of millimetres.'
  }
  if (!isAbrasive(wheelItem.abrasive)) return 'Abrasive must be diamond or CBN.'
  if (!isGrit(wheelItem.grit)) return 'Grit must be coarse, medium, or fine.'
  if (wheelItem.duties.length === 0) return 'Mark at least one job for each wheel.'
  if (wheelItem.duties.some((duty) => !isDuty(duty))) return 'A wheel job is not recognized.'
  return null
}

export function validatePack(packItem: WheelPack): string | null {
  if (!packItem.id.trim()) return 'The pack needs an id.'
  if (!packItem.name.trim()) return 'The pack needs a name.'
  if (packItem.wheels.length === 0) return 'Add at least one wheel.'
  const ids = new Set<string>()
  for (const item of packItem.wheels) {
    const error = validateWheel(item)
    if (error) return error
    if (ids.has(item.id)) return 'Two wheels in this pack share an id.'
    ids.add(item.id)
  }
  return null
}

export type ParseCatalogResult =
  | { ok: true; packs: WheelPack[] }
  | { ok: false; error: string }

function readWheel(raw: unknown, index: number): { wheel: CatalogWheel } | { error: string } {
  if (!isRecord(raw)) return { error: `Wheel ${index + 1} is not an object.` }
  if (!isShape(raw.shape)) return { error: 'Wheel shape must be 1A1, 1V1, 11V9, or 12V9.' }
  if (typeof raw.diameterMm !== 'number' || raw.diameterMm <= 0) {
    return { error: 'Wheel diameter must be a positive number of millimetres.' }
  }
  if (typeof raw.widthMm !== 'number' || raw.widthMm <= 0) {
    return { error: 'Wheel width must be a positive number of millimetres.' }
  }
  if (!isAbrasive(raw.abrasive)) return { error: 'Abrasive must be diamond or CBN.' }
  if (!isGrit(raw.grit)) return { error: 'Grit must be coarse, medium, or fine.' }
  if (!Array.isArray(raw.duties) || raw.duties.length === 0 || raw.duties.some((duty) => !isDuty(duty))) {
    return { error: 'Each wheel needs one or more jobs: od, flute, clearance, gash, point, chamfer.' }
  }
  if (typeof raw.id !== 'string' || !raw.id.trim()) return { error: 'Each wheel needs an id.' }
  if (typeof raw.name !== 'string' || !raw.name.trim()) return { error: 'Each wheel needs a name.' }
  const parsed: CatalogWheel = {
    id: raw.id,
    name: raw.name,
    shape: raw.shape,
    diameterMm: raw.diameterMm,
    widthMm: raw.widthMm,
    abrasive: raw.abrasive,
    grit: raw.grit,
    duties: raw.duties,
  }
  return { wheel: parsed }
}

export function parseWheelCatalog(text: string): ParseCatalogResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Wheel catalog is not valid JSON.' }
  }
  if (!isRecord(raw)) return { ok: false, error: 'Wheel catalog must be a JSON object.' }
  if (raw.schema !== WHEEL_CATALOG_SCHEMA) {
    return { ok: false, error: 'Wheel catalog schema must be tgxStudioWheelCatalog.' }
  }
  if (raw.schemaVersion !== WHEEL_CATALOG_SCHEMA_VERSION) {
    return { ok: false, error: 'Wheel catalog schemaVersion must be 1.' }
  }
  if (!Array.isArray(raw.packs)) return { ok: false, error: 'Wheel catalog needs a packs array.' }

  const packs: WheelPack[] = []
  for (const item of raw.packs) {
    if (!isRecord(item)) return { ok: false, error: 'Each pack must be an object.' }
    if (typeof item.id !== 'string' || !item.id.trim()) return { ok: false, error: 'Each pack needs an id.' }
    if (typeof item.name !== 'string' || !item.name.trim()) return { ok: false, error: 'Each pack needs a name.' }
    if (!Array.isArray(item.wheels)) return { ok: false, error: 'Each pack needs a wheels array.' }
    const wheels: CatalogWheel[] = []
    for (let index = 0; index < item.wheels.length; index += 1) {
      const read = readWheel(item.wheels[index], index)
      if ('error' in read) return { ok: false, error: read.error }
      wheels.push(read.wheel)
    }
    const parsed: WheelPack = {
      id: item.id,
      name: item.name,
      notes: typeof item.notes === 'string' ? item.notes : '',
      source: 'custom',
      wheels,
    }
    const error = validatePack(parsed)
    if (error) return { ok: false, error }
    packs.push(parsed)
  }
  return { ok: true, packs }
}

export function serializeWheelCatalog(packs: readonly WheelPack[]): string {
  const file: WheelCatalogFile = {
    schema: WHEEL_CATALOG_SCHEMA,
    schemaVersion: WHEEL_CATALOG_SCHEMA_VERSION,
    packs: packs.map((item) => ({
      id: item.id,
      name: item.name,
      notes: item.notes,
      source: item.source,
      wheels: item.wheels.map((wheelItem) => ({
        ...wheelItem,
        duties: [...wheelItem.duties],
      })),
    })),
  }
  return JSON.stringify(file, null, 2)
}

export function mergeCustomPacks(
  existing: readonly WheelPack[],
  incoming: readonly WheelPack[],
): { packs: WheelPack[]; skipped: string[] } {
  const skipped: string[] = []
  const map = new Map(existing.map((item) => [item.id, clonePack(item)]))
  for (const item of incoming) {
    if (CATALOG_IDS.has(item.id)) {
      skipped.push(item.id)
      continue
    }
    map.set(item.id, { ...clonePack(item), source: 'custom' })
  }
  return { packs: [...map.values()], skipped }
}

export function loadCustomPacks(): WheelPack[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(CUSTOM_PACKS_KEY)
    if (!raw) return []
    const parsed = parseWheelCatalog(raw)
    if (!parsed.ok) return []
    return parsed.packs
      .filter((item) => !CATALOG_IDS.has(item.id))
      .map((item) => ({ ...item, source: 'custom' as const }))
  } catch {
    return []
  }
}

export function saveCustomPacks(packs: readonly WheelPack[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(CUSTOM_PACKS_KEY, serializeWheelCatalog(packs))
  } catch {
    // Private browsing can refuse storage. The pack still works for this visit.
  }
}

export function readPackChoice(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const value = localStorage.getItem(PACK_CHOICE_KEY)
    if (!value || value === 'recommended') return null
    return value
  } catch {
    return null
  }
}

export function writePackChoice(id: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(PACK_CHOICE_KEY, id ?? 'recommended')
  } catch {
    // Ignore storage failures. The in-memory choice still applies.
  }
}
