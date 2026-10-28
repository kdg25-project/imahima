import { Hono } from 'hono'

const weatherRoutes = new Hono()

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

weatherRoutes.get('/', async (c) => {
  try {
    const latText = c.req.query('lat')
    const lngText = c.req.query('lng')

    if (
      latText === undefined ||
      lngText === undefined ||
      latText.trim() === '' ||
      lngText.trim() === ''
    ) {
      return c.json({ error: 'lat and lng are required' }, 400)
    }

    const lat = Number(latText)
    const lng = Number(lngText)

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return c.json({ error: 'Invalid lat or lng' }, 400)
    }

    const url = new URL('https://api.open-meteo.com/v1/forecast')

    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lng))
    url.searchParams.set(
      'current',
      'temperature_2m,precipitation,weather_code',
    )
    url.searchParams.set('timezone', 'auto')

    let data: unknown

    try {
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Open-Meteo request failed')
      }

      data = await response.json()
    } catch {
      return c.json({ error: 'Failed to fetch weather' }, 502)
    }

    if (!isObject(data) || !isObject(data.current)) {
      return c.json({ error: 'Invalid weather data' }, 502)
    }

    const {
      temperature_2m: temperature,
      weather_code: weatherCode,
      precipitation,
    } = data.current

    if (
      typeof temperature !== 'number' ||
      !Number.isFinite(temperature) ||
      typeof weatherCode !== 'number' ||
      !Number.isFinite(weatherCode) ||
      typeof precipitation !== 'number' ||
      !Number.isFinite(precipitation)
    ) {
      return c.json({ error: 'Invalid weather data' }, 502)
    }

    return c.json({ temperature, weatherCode, precipitation }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

export default weatherRoutes