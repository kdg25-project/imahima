export type SearchMode = 'nearby' | 'free-time'

export type SearchParams = {
  preview?: string
  mode: SearchMode
  category: string
  walkMinutes?: number
  freeTime?: number
  area: string
  lat?: number
  lng?: number
  name?: string
  from?: 'favorites'
}

export type HomeSearchParams = Partial<SearchParams>

function parseNumber(value: unknown): number | undefined {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

export function parseSearchParams(search: Record<string, unknown>): SearchParams {
  return {
    preview: typeof search.preview === 'string' ? search.preview : undefined,
    mode: search.mode === 'free-time' ? 'free-time' : 'nearby',
    category: typeof search.category === 'string' ? search.category : 'すべて',
    walkMinutes: parseNumber(search.walkMinutes),
    freeTime: parseNumber(search.freeTime),
    area: typeof search.area === 'string' ? search.area : '現在地周辺',
    lat: parseNumber(search.lat),
    lng: parseNumber(search.lng),
    name: typeof search.name === 'string' ? search.name : undefined,
    from: search.from === 'favorites' ? 'favorites' : undefined,
  }
}

export function parseHomeSearchParams(search: Record<string, unknown>): HomeSearchParams {
  return parseSearchParams(search)
}

export function hasSearchCoordinates(search: SearchParams): search is SearchParams & { lat: number; lng: number } {
  return search.lat !== undefined && search.lng !== undefined
}

export function searchSummary(search: SearchParams) {
  const conditions = [search.name ?? search.area]
  if (search.mode === 'nearby' && search.walkMinutes) conditions.push(`徒歩${search.walkMinutes}分圏内`)
  if (search.mode === 'free-time' && search.freeTime) conditions.push(`空き時間${search.freeTime}分`)
  conditions.push(search.category)
  return conditions.join('・')
}
