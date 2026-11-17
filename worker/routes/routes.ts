import { Hono } from 'hono'
import { getWalkingRoute } from '../lib/route-provider'

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

  const route = await getWalkingRoute({
    origin,
    destination,
    apiKey,
    signal: c.req.raw.signal,
  })

  if (route.kind === 'not-found') {
    return c.json({ error: 'No route found' }, 404)
  }
  if (route.kind === 'configuration') {
    return c.json({ error: 'Internal server error' }, 500)
  }
  if (route.kind === 'failure') {
    return c.json({ error: 'Failed to fetch route from external API' }, 502)
  }

  return c.json({
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
  })
})

export default app
