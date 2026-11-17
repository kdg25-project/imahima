import { Hono } from 'hono'
import placesRoutes, { type PlaceResult } from './places'
import weatherRoutes from './weather'

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
}

const searchRoutes = new Hono<{ Bindings: Bindings }>()

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
    durationText !== undefined &&
    (duration === undefined || duration <= 0)
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
      weatherRoutes.request('/?' + weatherQuery.toString(), undefined, c.env),
      placesRoutes.request('/?' + placesQuery.toString(), undefined, c.env),
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

    return c.json({ weather, places }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

export default searchRoutes