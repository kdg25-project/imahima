import { afterEach, describe, expect, it, vi } from 'vitest'
import app from '../index'

describe('GET /api/search の入力チェック', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    '/api/search?lng=136&mode=nearby',
    '/api/search?lat=35&mode=nearby',
    '/api/search?lat=%20&lng=136&mode=nearby',
    '/api/search?lat=abc&lng=136&mode=nearby',
    '/api/search?lat=91&lng=136&mode=nearby',
    '/api/search?lat=35&lng=-181&mode=nearby',
    '/api/search?lat=35&lng=136',
    '/api/search?lat=35&lng=136&mode=unknown',
    '/api/search?lat=35&lng=136&mode=nearby&category=unknown',
    '/api/search?lat=35&lng=136&mode=nearby&radius=abc',
    '/api/search?lat=35&lng=136&mode=nearby&radius=0',
    '/api/search?lat=35&lng=136&mode=nearby&radius=50001',
    '/api/search?lat=35&lng=136&mode=free-time&duration=abc',
    '/api/search?lat=35&lng=136&mode=free-time&duration=0',
  ])('不正な入力で400を返す %s', async (path) => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(
      new Error('Unexpected fetch during validation'),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await app.request(path)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: expect.any(String) })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  describe('GET /api/search の取得処理', () => {
    const path = '/api/search?lat=35.1709&lng=136.8815&mode=nearby'
    const env = { GOOGLE_PLACES_API_KEY: 'test-google-key' }

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    function mockProviders(failure?: 'weather' | 'places') {
      const responses = new Map([
        ['api.open-meteo.com', Response.json({
          current: {
            temperature_2m: 24.2,
            weather_code: 3,
            precipitation: 0,
          },
        })],
        ['places.googleapis.com', Response.json({
          places: [{
            id: 'place-1',
            displayName: { text: 'テストカフェ' },
            types: ['cafe'],
            location: { latitude: 35.171, longitude: 136.882 },
          }],
        })],
      ])

      if (failure === 'weather') {
        responses.set('api.open-meteo.com', new Response(null, { status: 503 }))
      }
      if (failure === 'places') {
        responses.set('places.googleapis.com', new Response(null, { status: 503 }))
      }

      const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const response = responses.get(new URL(String(input)).hostname)
        if (!response) throw new Error('Unexpected fetch')
        return response
      })
      vi.stubGlobal('fetch', fetchMock)
      return fetchMock
    }

    it('天気と施設をまとめて返し、anyではカテゴリを絞らない', async () => {
      const fetchMock = mockProviders()
      const response = await app.request(path, undefined, env)

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        weather: { temperature: 24.2, weatherCode: 3, precipitation: 0 },
        places: [{ id: 'place-1', name: 'テストカフェ', category: 'cafe' }],
      })

      const placeCall = fetchMock.mock.calls.find(
        ([input]) => String(input).startsWith('https://places.googleapis.com/'),
      )
      const body = JSON.parse(String(placeCall?.[1]?.body))

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(body).not.toHaveProperty('includedTypes')
      expect(body.locationRestriction.circle.radius).toBe(1000)
    })

    it('指定カテゴリと半径を周辺施設の取得へ渡す', async () => {
      const fetchMock = mockProviders()
      const response = await app.request(
        path + '&category=study&radius=1500',
        undefined,
        env,
      )
      const placeCall = fetchMock.mock.calls.find(
        ([input]) => String(input).startsWith('https://places.googleapis.com/'),
      )
      const body = JSON.parse(String(placeCall?.[1]?.body))

      expect(response.status).toBe(200)
      expect(body.includedTypes).toEqual(['library', 'cafe'])
      expect(body.locationRestriction.circle.radius).toBe(1500)
    })

    it.each(['weather', 'places'] as const)(
      '%sの外部API失敗は502を返す',
      async (failure) => {
        mockProviders(failure)
        const response = await app.request(path, undefined, env)
        expect(response.status).toBe(502)
      },
    )
    it('APIキー未設定は500を返す', async () => {
      mockProviders()
      const response = await app.request(path)
      expect(response.status).toBe(500)
    })
  })
  describe('GET /api/search の検索結果0件', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it.each([
      { body: {} },
      { body: { places: [] } },
    ])('候補が0件なら天気と空配列を返す %#', async ({ body }) => {
      const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const url = new URL(String(input))

        if (url.hostname === 'api.open-meteo.com') {
          return Response.json({
            current: {
              temperature_2m: 24.2,
              weather_code: 3,
              precipitation: 0,
            },
          })
        }
        if (url.hostname === 'places.googleapis.com') {
          return Response.json(body)
        }
        throw new Error('Unexpected fetch')
      })
      vi.stubGlobal('fetch', fetchMock)

      const response = await app.request(
        '/api/search?lat=35.1709&lng=136.8815&mode=nearby',
        undefined,
        { GOOGLE_PLACES_API_KEY: 'test-google-key' },
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        weather: { temperature: 24.2, weatherCode: 3, precipitation: 0 },
        places: [],
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('GET /api/search の距離と評価', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it.each([
      [0, 0, { latitude: 0, longitude: 0 }, 0],
      [35.1709, 136.8815, { latitude: 35.171, longitude: 136.882 }, 47],
      [0, 0, { latitude: 0, longitude: 0.01 }, 1112],
      [0, 179.999, { latitude: 0, longitude: -179.999 }, 222],
      [35, 136, null, null],
      [35, 136, { latitude: 91, longitude: 136 }, null],
    ] as const)('距離をメートルで返す %#', async (lat, lng, location, expected) => {
      const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const hostname = new URL(String(input)).hostname

        if (hostname === 'api.open-meteo.com') {
          return Response.json({
            current: {
              temperature_2m: 24.2,
              weather_code: 3,
              precipitation: 0,
            },
          })
        }
        if (hostname === 'places.googleapis.com') {
          return Response.json({
            places: [{
              id: 'place-1',
              displayName: { text: 'テストカフェ' },
              types: ['cafe'],
              location,
              rating: 4.2,
            }],
          })
        }
        throw new Error('Unexpected fetch')
      })
      vi.stubGlobal('fetch', fetchMock)

      const response = await app.request(
        '/api/search?lat=' + lat + '&lng=' + lng + '&mode=nearby&radius=50000',
        undefined,
        { GOOGLE_PLACES_API_KEY: 'test-google-key' },
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        places: [{ id: 'place-1', rating: 4.2, distance: expected }],
      })
    })
  })
})