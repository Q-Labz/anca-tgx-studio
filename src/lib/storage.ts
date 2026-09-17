import type { JobTraveler, SavedDesign } from './types'

const DESIGNS_KEY = 'anca-tgx-studio:designs'
const TRAVELERS_KEY = 'anca-tgx-studio:travelers'

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write<T>(key: string, value: T[]): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function listDesigns(): SavedDesign[] {
  return read<SavedDesign>(DESIGNS_KEY).sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  )
}

export function saveDesign(design: SavedDesign): void {
  const all = listDesigns()
  const idx = all.findIndex((d) => d.id === design.id)
  if (idx >= 0) all[idx] = design
  else all.unshift(design)
  write(DESIGNS_KEY, all)
}

export function deleteDesign(id: string): void {
  write(
    DESIGNS_KEY,
    listDesigns().filter((d) => d.id !== id),
  )
}

export function getDesign(id: string): SavedDesign | undefined {
  return listDesigns().find((d) => d.id === id)
}

export function listTravelers(): JobTraveler[] {
  return read<JobTraveler>(TRAVELERS_KEY).sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  )
}

export function saveTraveler(traveler: JobTraveler): void {
  const all = listTravelers()
  const idx = all.findIndex((t) => t.id === traveler.id)
  if (idx >= 0) all[idx] = traveler
  else all.unshift(traveler)
  write(TRAVELERS_KEY, all)
}

export function deleteTraveler(id: string): void {
  write(
    TRAVELERS_KEY,
    listTravelers().filter((t) => t.id !== id),
  )
}

export function getTraveler(id: string): JobTraveler | undefined {
  return listTravelers().find((t) => t.id === id)
}
