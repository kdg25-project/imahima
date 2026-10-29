import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import app from './index'

describe('API', () => {
  it('returns health as JSON', async () => {
    const response = await app.request('/api/health')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  describe('weather', () => {
    const fetchMock = vi.fn<typeof fetch>()
    const validPath = '/api/weather?lat=35.1709&lng=136.8815'

    const currentWeather = {
      temperature_2m: 24.2,
      weather_code: 3,
      precipitation: 0,
    }

    beforeEach(() => {
      fetchMock.mockReset()
      fetchMock.mockResolvedValue(
        Response.json({ current: currentWeather }),
      )
      vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('returns current weather in the application format', async () => {
      const response = await app.request(validPath)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')
      expect(await response.json()).toEqual({
        temperature: 24.2,
        weatherCode: 3,
        precipitation: 0,
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)

      const url = new URL(String(fetchMock.mock.calls[0]?.[0]))

      expect(url.origin).toBe('https://api.open-meteo.com')
      expect(url.pathname).toBe('/v1/forecast')
      expect(url.searchParams.get('latitude')).toBe('35.1709')
      expect(url.searchParams.get('longitude')).toBe('136.8815')
      expect(url.searchParams.get('current')).toBe(
        'temperature_2m,precipitation,weather_code',
      )
      expect(url.searchParams.get('timezone')).toBe('auto')
    })

    it.each([
      '/api/weather?lat=0&lng=0',
      '/api/weather?lat=-90&lng=-180',
      '/api/weather?lat=90&lng=180',
    ])('accepts valid coordinates: %s', async (path) => {
      const response = await app.request(path)

      expect(response.status).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it.each([
      '/api/weather',
      '/api/weather?lat=35',
      '/api/weather?lng=136',
      '/api/weather?lat=&lng=136',
      '/api/weather?lat=35&lng=',
      '/api/weather?lat=%20&lng=136',
      '/api/weather?lat=35&lng=%20',
      '/api/weather?lat=abc&lng=136',
      '/api/weather?lat=35&lng=abc',
      '/api/weather?lat=35abc&lng=136',
      '/api/weather?lat=NaN&lng=136',
      '/api/weather?lat=Infinity&lng=136',
      '/api/weather?lat=35&lng=-Infinity',
      '/api/weather?lat=91&lng=136',
      '/api/weather?lat=-91&lng=136',
      '/api/weather?lat=35&lng=181',
      '/api/weather?lat=35&lng=-181',
    ])('returns 400 for invalid coordinates: %s', async (path) => {
      const response = await app.request(path)

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: expect.any(String),
      })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns 502 when the external request fails', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'))

      const response = await app.request(validPath)

      expect(response.status).toBe(502)
      expect(await response.json()).toEqual({
        error: expect.any(String),
      })
    })

    it.each([400, 429, 500, 503])(
      'returns 502 when Open-Meteo returns %i',
      async (status) => {
        fetchMock.mockResolvedValue(new Response(null, { status }))

        const response = await app.request(validPath)

        expect(response.status).toBe(502)
        expect(await response.json()).toEqual({
          error: expect.any(String),
        })
      },
    )

    it('returns 502 when the external response is not valid JSON', async () => {
      fetchMock.mockResolvedValue(new Response('not json'))

      const response = await app.request(validPath)

      expect(response.status).toBe(502)
      expect(await response.json()).toEqual({
        error: expect.any(String),
      })
    })

    it.each([
      { body: null },
      { body: {} },
      { body: { current: null } },
      { body: { current: {} } },
      { body: { current: { weather_code: 3, precipitation: 0 } } },
      { body: { current: { temperature_2m: 24.2, precipitation: 0 } } },
      { body: { current: { temperature_2m: 24.2, weather_code: 3 } } },
      { body: { current: { ...currentWeather, temperature_2m: '24.2' } } },
      { body: { current: { ...currentWeather, weather_code: '3' } } },
      { body: { current: { ...currentWeather, precipitation: null } } },
    ])('returns 502 for invalid weather data: %#', async ({ body }) => {
      fetchMock.mockResolvedValue(Response.json(body))

      const response = await app.request(validPath)

      expect(response.status).toBe(502)
      expect(await response.json()).toEqual({
        error: expect.any(String),
      })
    })
  })

  describe('location reverse geocoding', () => {
    const fetchMock = vi.fn<typeof fetch>()

    beforeEach(() => {
      fetchMock.mockReset()
      vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('returns a Japanese address name', async () => {
      fetchMock.mockResolvedValue(Response.json({
        principalSubdivision: '愛知県',
        city: '名古屋市',
        locality: '中区',
      }))

      const response = await app.request('/api/location/reverse?lat=35.1709&lng=136.8815')

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ name: '愛知県 名古屋市 中区' })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('rejects invalid coordinates', async () => {
      const response = await app.request('/api/location/reverse?lat=91&lng=136')

      expect(response.status).toBe(400)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('searches arbitrary place names and returns selectable coordinates', async () => {
      fetchMock.mockResolvedValue(Response.json([
        {
          name: '名古屋駅',
          display_name: '名古屋駅, 名古屋市, 愛知県, 日本',
          address: { state: '愛知県', city: '名古屋市', suburb: '中村区' },
          lat: '35.170915',
          lon: '136.881537',
        },
        {
          name: '名古屋駅',
          display_name: '名古屋駅, 中村区, 名古屋市, 愛知県, 日本',
          lat: '35.1709151',
          lon: '136.8815371',
        },
      ]))

      const response = await app.request('/api/location/search?q=名古屋駅')

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        candidates: [{
          name: '名古屋駅',
          area: '愛知県 名古屋市 中村区',
          lat: 35.170915,
          lng: 136.881537,
        }],
      })
      const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
      expect(url.origin).toBe('https://nominatim.openstreetmap.org')
      expect(url.pathname).toBe('/search')
      expect(url.searchParams.get('q')).toBe('名古屋駅')
      expect(url.searchParams.get('countrycodes')).toBe('jp')
    })

    it('does not call the geocoder for an empty query', async () => {
      const response = await app.request('/api/location/search?q=')

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ candidates: [] })
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  it.each(['/api', '/api/missing'])('returns JSON 404 for %s', async (path) => {
    const response = await app.request(path, { headers: { accept: 'text/html' } })
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ error: 'Not Found' })
  })
})
