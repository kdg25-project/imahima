import { Hono } from 'hono'

type Bindings = {
  GOOGLE_MAPS_API_KEY: string
}

type Location = {
  lat: number
  lng: number
}

type RoutesRequestBody = {
  origin?: Location
  destination?: Location
  travelMode?: string
}

const app = new Hono<{ Bindings: Bindings }>()

function isValidLocation(value: unknown): value is Location {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const { lat, lng } = value as Record<string, unknown>
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  )
}

function isRouteRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseDurationSeconds(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,9})?s$/.test(value)) {
    return undefined
  }

  const durationSeconds = Number(value.slice(0, -1))
  return Number.isFinite(durationSeconds) && durationSeconds >= 0
    ? durationSeconds
    : undefined
}

app.post('/api/routes', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }

  if (!isRouteRecord(body)) {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const { origin, destination, travelMode } = body as RoutesRequestBody
  if (!isValidLocation(origin) || !isValidLocation(destination)) {
    return c.json({ error: 'Invalid origin or destination coordinates' }, 400)
  }
  if (travelMode !== 'WALK') {
    return c.json({ error: 'Unsupported travelMode. Only WALK is allowed' }, 400)
  }

  const apiKey = c.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.error('GOOGLE_MAPS_API_KEY is not configured.')
    return c.json({ error: 'Internal server error' }, 500)
  }

  let response: Response
  try {
    response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: {
          location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
        },
        travelMode: 'WALK',
      }),
    })
  } catch {
    return c.json({ error: 'Failed to fetch route from external API' }, 502)
  }

  if (!response.ok) {
    console.error(`Google Routes API error: status ${response.status}`)
    return c.json({ error: 'Failed to fetch route from external API' }, 502)
  }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    return c.json({ error: 'Failed to fetch route from external API' }, 502)
  }

  if (!isRouteRecord(data) || !Array.isArray(data.routes)) {
    return c.json({ error: 'Invalid route data from external API' }, 502)
  }
  if (data.routes.length === 0) {
    return c.json({ error: 'No route found' }, 404)
  }

  const route = data.routes[0]
  if (!isRouteRecord(route)) {
    return c.json({ error: 'Invalid route data from external API' }, 502)
  }

  const { distanceMeters, duration } = route
  const durationSeconds = parseDurationSeconds(duration)
  if (
    typeof distanceMeters !== 'number' ||
    !Number.isFinite(distanceMeters) ||
    distanceMeters < 0 ||
    durationSeconds === undefined
  ) {
    return c.json({ error: 'Invalid route data from external API' }, 502)
  }

  return c.json({ distanceMeters, durationSeconds })
})

export default app
