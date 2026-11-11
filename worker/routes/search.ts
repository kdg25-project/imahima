import { Hono } from 'hono'

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

const searchRoutes = new Hono()

searchRoutes.get('/', (c) => {
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

  return c.json({ error: 'Not Implemented' }, 501)
})

export default searchRoutes