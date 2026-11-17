import { Hono } from 'hono'
import placesRoutes, { type PlaceResult } from './places'
import weatherRoutes from './weather'
import { getWalkingRoute } from '../lib/route-provider'
import { rankPlaces } from '../lib/search-ranking'

const searchCategories = new Set([
  'any',
  'cafe',
  'food',
  'shopping',
  'entertainment',
  'sightseeing',
  'park',
  'study',
  'rest',
])

function parseFiniteNumber(text: string | undefined): number | undefined {
  if (text === undefined || text.trim() === '') {
    return undefined
  }

  const value = Number(text)
  return Number.isFinite(value) ? value : undefined
}

function calculateDistanceMeters(
  originLat: number,
  originLng: number,
  destination: PlaceResult['location'],
): number | null {
  if (
    destination === null ||
    !Number.isFinite(destination.lat) ||
    !Number.isFinite(destination.lng) ||
    destination.lat < -90 ||
    destination.lat > 90 ||
    destination.lng < -180 ||
    destination.lng > 180
  ) {
    return null
  }

  const earthRadiusMeters = 6_371_000
  const radians = Math.PI / 180
  const latitudeDifference = (destination.lat - originLat) * radians
  const longitudeDifference = (destination.lng - originLng) * radians
  const originLatitude = originLat * radians
  const destinationLatitude = destination.lat * radians

  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDifference / 2) ** 2

  const boundedHaversine = Math.max(0, Math.min(1, haversine))
  const angle = 2 * Math.atan2(
    Math.sqrt(boundedHaversine),
    Math.sqrt(1 - boundedHaversine),
  )

  return Math.round(earthRadiusMeters * angle)
}

type Bindings = {
  GOOGLE_PLACES_API_KEY?: string
  GOOGLE_MAPS_API_KEY?: string
}

const searchRoutes = new Hono<{ Bindings: Bindings }>()

class RouteProviderFailure extends Error {}
class RouteProviderConfigurationError extends Error {}

async function mapWithConcurrency<T, Result>(
  values: T[],
  limit: number,
  mapper: (value: T, signal: AbortSignal) => Promise<Result>,
  callerSignal?: AbortSignal,
): Promise<Result[]> {
  const results = new Array<Result>(values.length)
  let nextIndex = 0
  let firstError: unknown
  const controller = new AbortController()
  const abort = () => controller.abort()

  if (callerSignal?.aborted) abort()
  else callerSignal?.addEventListener('abort', abort, { once: true })

  async function worker() {
    while (!firstError && !controller.signal.aborted && nextIndex < values.length) {
      const index = nextIndex++
      try {
        results[index] = await mapper(values[index], controller.signal)
      } catch (error) {
        if (!firstError) {
          firstError = error
          controller.abort()
        }
      }
    }
  }

  try {
    await Promise.all(
      Array.from({ length: Math.min(limit, values.length) }, () => worker()),
    )
  } finally {
    callerSignal?.removeEventListener('abort', abort)
  }
  if (firstError) throw firstError
  return results
}

searchRoutes.get('/',async (c) => {
  const lat = parseFiniteNumber(c.req.query('lat'))
  const lng = parseFiniteNumber(c.req.query('lng'))

  if (
    lat === undefined ||
    lng === undefined ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return c.json({ error: 'Invalid lat or lng' }, 400)
  }

  const mode = c.req.query('mode')
  if (mode !== 'nearby' && mode !== 'free-time') {
    return c.json({ error: 'Invalid mode' }, 400)
  }

  const category = c.req.query('category') ?? 'any'
  if (!searchCategories.has(category)) {
    return c.json({ error: 'Invalid category' }, 400)
  }

  const radiusText = c.req.query('radius')
  const radius = parseFiniteNumber(radiusText)

  if (
    radiusText !== undefined &&
    (radius === undefined || radius <= 0 || radius > 50000)
  ) {
    return c.json({ error: 'Invalid radius' }, 400)
  }

  const durationText = c.req.query('duration')
  const duration = parseFiniteNumber(durationText)

  if (
    mode === 'free-time' &&
    (durationText === undefined || duration === undefined || duration <= 0)
  ) {
    return c.json({ error: 'Invalid duration' }, 400)
  }

  try {
    const weatherQuery = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
    })
    const placesQuery = new URLSearchParams(weatherQuery)

    if (category !== 'any') {
      placesQuery.set('category', category)
    }
    if (radius !== undefined) {
      placesQuery.set('radius', String(radius))
    }

    const [weatherResponse, placesResponse] = await Promise.all([
      weatherRoutes.request(
        new Request('http://internal/?' + weatherQuery.toString(), {
          signal: c.req.raw.signal,
        }),
        undefined,
        c.env,
      ),
      placesRoutes.request(
        new Request('http://internal/?' + placesQuery.toString(), {
          signal: c.req.raw.signal,
        }),
        undefined,
        c.env,
      ),
    ])

    if (!weatherResponse.ok) {
      return c.json(
        { error: 'Failed to fetch weather' },
        weatherResponse.status === 502 ? 502 : 500,
      )
    }
    if (!placesResponse.ok) {
      return c.json(
        { error: 'Failed to fetch places' },
        placesResponse.status === 502 ? 502 : 500,
      )
    }

    const weather = await weatherResponse.json()
    const placesResult = (await placesResponse.json()) as {
      places: PlaceResult[]
    }

    const places = placesResult.places.map((place) => ({
      ...place,
      distance: calculateDistanceMeters(lat, lng, place.location),
    }))

    const routes = await mapWithConcurrency(places, 4, async (place, signal) => {
      if (!place.location || place.distance === null) return null
      const route = await getWalkingRoute({
        origin: { lat, lng },
        destination: place.location,
        apiKey: c.env.GOOGLE_MAPS_API_KEY,
        signal,
      })
      if (route.kind === 'configuration') throw new RouteProviderConfigurationError()
      if (route.kind === 'failure') throw new RouteProviderFailure()
      return route.kind === 'ok' ? route : null
    }, c.req.raw.signal)
    return c.json({
      weather,
      places: rankPlaces({
        places,
        routes,
        weather: weather as {
          temperature: number
          weatherCode: number
          precipitation: number
        },
        mode,
        category,
        duration,
      }),
    }, 200)
  } catch (error) {
    if (error instanceof RouteProviderConfigurationError) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
    if (error instanceof RouteProviderFailure) {
      return c.json({ error: 'Failed to fetch routes' }, 502)
    }
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

export default searchRoutes
