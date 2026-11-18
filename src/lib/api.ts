import { categoryLabels, isPoiCategory, normalizePoiCategory, type PoiCategory } from '../../shared/poi-taxonomy'

export type Coordinates = {
  lat: number
  lng: number
}

export type AuthorAttribution = {
  displayName?: string
  uri?: string
  photoUri?: string
}

export type PlacePhoto = {
  name?: string
  widthPx?: number
  heightPx?: number
  authorAttributions: AuthorAttribution[]
}

export type PlaceSummary = {
  id: string | null
  name: string | null
  category: string | null
  location: Coordinates | null
  rating: number | null
  openNow: boolean | null
  photos: PlacePhoto[]
}

export type PlaceDetails = PlaceSummary & {
  address: string | null
}

export type WalkingRoute = {
  distanceMeters: number
  durationSeconds: number
}

export type Weather = {
  temperature: number
  weatherCode: number
  precipitation: number
}

/** A server-ranked search result. `distance` is straight-line distance; walking
 * distance and duration are supplied separately by the Routes API. */
export type SearchPlace = PlaceSummary & {
  distance: number | null
  walkingDistanceMeters: number | null
  walkingDurationSeconds: number | null
  availableStayMinutes: number | null
  score: number
  reason: string
  reasons: string[]
}

export type SearchResult = { weather: Weather; places: SearchPlace[] }

export type AppCategory = PoiCategory
export { categoryLabels }

const categoryByLabel: Record<string, AppCategory | undefined> = {
  カフェ: 'cafe',
  ごはん: 'food',
  買い物: 'shopping',
  遊び: 'entertainment',
  観光: 'sightseeing',
  運動: 'exercise',
  自然: 'park',
  その他: 'rest',
}

export function categoryToApiValue(label: string) {
  return categoryByLabel[label]
}

export function normalizePlaceCategory(value: string | null) {
  if (!value) return undefined
  return isPoiCategory(value)
    ? value
    : categoryByLabel[value] ?? normalizePoiCategory(value)
}

export function displayPlaceCategory(value: string | null) {
  const category = normalizePlaceCategory(value)
  return category ? categoryLabels[category] : value ? categoryLabels.rest : undefined
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new ApiError(response.status || 502, '応答を読み取れませんでした。')
  }
}

async function requestJson(url: string, init?: RequestInit, timeoutMs?: number) {
  const controller = timeoutMs === undefined ? undefined : new AbortController()
  let timedOut = false
  const abortFromCaller = () => controller?.abort()
  if (controller && init?.signal) {
    if (init.signal.aborted) controller.abort()
    else init.signal.addEventListener('abort', abortFromCaller, { once: true })
  }
  const timeout = controller && timeoutMs !== undefined
    ? setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
    : undefined

  try {
    const response = await fetch(url, controller ? { ...init, signal: controller.signal } : init)
    const data = await readJson(response)
    if (!response.ok) {
      const message = typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
        ? data.error
        : '取得できませんでした。'
      throw new ApiError(response.status, message)
    }
    return data
  } catch (error) {
    if (timedOut) throw new ApiError(408, '応答が遅れているため、経路を確認できませんでした。')
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, '通信できませんでした。')
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
    init?.signal?.removeEventListener('abort', abortFromCaller)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCoordinates(value: unknown): value is Coordinates {
  return isRecord(value) && typeof value.lat === 'number' && Number.isFinite(value.lat) && typeof value.lng === 'number' && Number.isFinite(value.lng)
}

function parsePhotos(value: unknown): PlacePhoto[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((photo) => {
    if (!isRecord(photo)) return []
    const authorAttributions = Array.isArray(photo.authorAttributions)
      ? photo.authorAttributions.flatMap((attribution) => isRecord(attribution) ? [{
        ...(typeof attribution.displayName === 'string' ? { displayName: attribution.displayName } : {}),
        ...(typeof attribution.uri === 'string' ? { uri: attribution.uri } : {}),
        ...(typeof attribution.photoUri === 'string' ? { photoUri: attribution.photoUri } : {}),
      }] : [])
      : []
    return [{
      ...(typeof photo.name === 'string' ? { name: photo.name } : {}),
      ...(typeof photo.widthPx === 'number' ? { widthPx: photo.widthPx } : {}),
      ...(typeof photo.heightPx === 'number' ? { heightPx: photo.heightPx } : {}),
      authorAttributions,
    }]
  })
}

function parsePlace(value: unknown, includeAddress: boolean): PlaceSummary | PlaceDetails {
  if (!isRecord(value)) throw new ApiError(502, '施設情報の形式が不正です。')
  const place = {
    id: typeof value.id === 'string' ? value.id : null,
    name: typeof value.name === 'string' ? value.name : null,
    category: typeof value.appCategory === 'string' && isPoiCategory(value.appCategory)
      ? value.appCategory
      : typeof value.category === 'string' ? value.category : null,
    location: isCoordinates(value.location) ? value.location : null,
    rating: typeof value.rating === 'number' && Number.isFinite(value.rating) ? value.rating : null,
    openNow: typeof value.openNow === 'boolean' ? value.openNow : null,
    photos: parsePhotos(value.photos),
  }
  return includeAddress ? { ...place, address: typeof value.address === 'string' ? value.address : null } : place
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseSearchPlace(value: unknown): SearchPlace {
  const place = parsePlace(value, false) as PlaceSummary
  if (!isRecord(value)) throw new ApiError(502, '検索結果の形式が不正です。')
  const reason = typeof value.reason === 'string' ? value.reason : undefined
  const reasons = Array.isArray(value.reasons) ? value.reasons.filter((item): item is string => typeof item === 'string') : []
  const score = finiteOrNull(value.score)
  if (score === null || !reason) throw new ApiError(502, '検索結果の形式が不正です。')
  return {
    ...place,
    distance: finiteOrNull(value.distance),
    walkingDistanceMeters: finiteOrNull(value.walkingDistanceMeters),
    walkingDurationSeconds: finiteOrNull(value.walkingDurationSeconds),
    availableStayMinutes: finiteOrNull(value.availableStayMinutes),
    score,
    reason,
    reasons,
  }
}

export async function getSearch({ coordinates, mode, category, duration, walkMinutes, signal }: {
  coordinates: Coordinates
  mode: 'nearby' | 'free-time'
  category?: AppCategory
  duration?: number
  walkMinutes?: number
  signal?: AbortSignal
}): Promise<SearchResult> {
  const query = new URLSearchParams({
    lat: String(coordinates.lat),
    lng: String(coordinates.lng),
    mode,
    category: category ?? 'any',
  })
  if (mode === 'free-time' && duration !== undefined) query.set('duration', String(duration))
  if (mode === 'nearby' && walkMinutes !== undefined) query.set('walkMinutes', String(walkMinutes))
  const data = await requestJson(`/api/search?${query}`, { signal })
  if (!isRecord(data) || !isRecord(data.weather) || !Array.isArray(data.places)) throw new ApiError(502, '検索結果の形式が不正です。')
  const weather = data.weather
  if (typeof weather.temperature !== 'number' || typeof weather.weatherCode !== 'number' || typeof weather.precipitation !== 'number') throw new ApiError(502, '天気情報の形式が不正です。')
  return {
    weather: { temperature: weather.temperature, weatherCode: weather.weatherCode, precipitation: weather.precipitation },
    places: data.places.map(parseSearchPlace),
  }
}

export async function getNearbyPlaces({ coordinates, category, radius = 1000, signal }: {
  coordinates: Coordinates
  category?: AppCategory
  radius?: number
  signal?: AbortSignal
}) {
  const query = new URLSearchParams({ lat: String(coordinates.lat), lng: String(coordinates.lng), radius: String(radius) })
  if (category) query.set('category', category)
  const data = await requestJson(`/api/places?${query}`, { signal })
  if (!isRecord(data) || !Array.isArray(data.places)) throw new ApiError(502, '施設情報の形式が不正です。')
  return data.places.map((place) => parsePlace(place, false) as PlaceSummary).filter((place) => place.id !== null && place.name !== null && place.location !== null)
}

export async function getPlaceDetails(placeId: string, options: { signal?: AbortSignal } = {}): Promise<PlaceDetails> {
  const data = await requestJson(`/api/places/${encodeURIComponent(placeId)}`, { signal: options.signal })
  return parsePlace(data, true) as PlaceDetails
}

export async function getWalkingRoute({ origin, destination, signal }: { origin: Coordinates; destination: Coordinates; signal?: AbortSignal }): Promise<WalkingRoute> {
  const data = await requestJson('/api/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination, travelMode: 'WALK' }),
    signal,
  }, 5_000)
  if (!isRecord(data) || typeof data.distanceMeters !== 'number' || !Number.isFinite(data.distanceMeters) || typeof data.durationSeconds !== 'number' || !Number.isFinite(data.durationSeconds)) {
    throw new ApiError(502, '経路情報の形式が不正です。')
  }
  return { distanceMeters: data.distanceMeters, durationSeconds: data.durationSeconds }
}

export async function getWeather({ coordinates, signal }: { coordinates: Coordinates; signal?: AbortSignal }): Promise<Weather> {
  const query = new URLSearchParams({ lat: String(coordinates.lat), lng: String(coordinates.lng) })
  const data = await requestJson(`/api/weather?${query}`, { signal })
  if (!isRecord(data) || typeof data.temperature !== 'number' || typeof data.weatherCode !== 'number' || typeof data.precipitation !== 'number') {
    throw new ApiError(502, '天気情報の形式が不正です。')
  }
  return { temperature: data.temperature, weatherCode: data.weatherCode, precipitation: data.precipitation }
}

export function formatDistance(distanceMeters: number) {
  return distanceMeters < 1000 ? `${Math.round(distanceMeters)}m` : `${(distanceMeters / 1000).toFixed(1)}km`
}

export function formatWalkingDuration(durationSeconds: number) {
  return `徒歩${walkingMinutesFromSeconds(durationSeconds)}分`
}
import { walkingMinutesFromSeconds } from './recommendation-policy'
