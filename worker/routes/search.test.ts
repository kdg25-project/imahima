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
    '/api/search?lat=35&lng=136&mode=free-time',
    '/api/search?lat=35&lng=136&mode=free-time&duration=%20',
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
    const env = { GOOGLE_PLACES_API_KEY: 'test-google-key', GOOGLE_MAPS_API_KEY: 'test-maps-key' }

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    function mockProviders(failure?: 'weather' | 'places' | 'routes' | 'no-route') {
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
        ['routes.googleapis.com', Response.json({ routes: [{ distanceMeters: 320, duration: '300s' }] })],
      ])

      if (failure === 'weather') {
        responses.set('api.open-meteo.com', new Response(null, { status: 503 }))
      }
      if (failure === 'places') {
        responses.set('places.googleapis.com', new Response(null, { status: 503 }))
      }
      if (failure === 'routes') {
        responses.set('routes.googleapis.com', new Response(null, { status: 503 }))
      }
      if (failure === 'no-route') {
        responses.set('routes.googleapis.com', Response.json({ routes: [] }))
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
        places: [{
          id: 'place-1',
          name: 'テストカフェ',
          category: 'cafe',
          reason: expect.any(String),
        }],
      })

      const placeCall = fetchMock.mock.calls.find(
        ([input]) => String(input).startsWith('https://places.googleapis.com/'),
      )
      const body = JSON.parse(String(placeCall?.[1]?.body))

      expect(fetchMock).toHaveBeenCalledTimes(3)
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

    it('既存画面の運動カテゴリと徒歩上限を受け付け、順位を変えずに上限外だけ除外する', async () => {
      const fetchMock = mockProviders()
      const response = await app.request(
        path + '&category=exercise&walkMinutes=4',
        undefined,
        env,
      )
      const body = await response.json() as { places: unknown[] }
      const placeCall = fetchMock.mock.calls.find(
        ([input]) => String(input).startsWith('https://places.googleapis.com/'),
      )

      expect(response.status).toBe(200)
      expect(body.places).toEqual([])
      expect(JSON.parse(String(placeCall?.[1]?.body)).includedTypes).toEqual(['gym', 'fitness_center', 'sports_complex'])
    })

    it.each(['weather', 'places'] as const)(
      '%sの外部API失敗は502を返す',
      async (failure) => {
        mockProviders(failure)
        const response = await app.request(path, undefined, env)
        expect(response.status).toBe(502)
      },
    )
    it.each(['nearby', 'free-time'] as const)(
      'Routesの外部API失敗は%sで502を返す',
      async (mode) => {
        mockProviders('routes')
        const response = await app.request(
          path.replace('mode=nearby', `mode=${mode}`) + (mode === 'free-time' ? '&duration=60' : ''),
          undefined,
          env,
        )
        expect(response.status).toBe(502)
      },
    )
    it('経路不存在はnearbyではnullを返し、free-timeでは候補を除外する', async () => {
      mockProviders('no-route')
      const nearby = await app.request(path, undefined, env)
      expect(nearby.status).toBe(200)
      expect(await nearby.json()).toMatchObject({
        places: [{ walkingDistanceMeters: null, walkingDurationSeconds: null }],
      })

      mockProviders('no-route')
      const freeTime = await app.request(path.replace('mode=nearby', 'mode=free-time&duration=60'), undefined, env)
      expect(freeTime.status).toBe(200)
      expect(await freeTime.json()).toMatchObject({ places: [] })
    })
    it('APIキー未設定は500を返す', async () => {
      mockProviders()
      const response = await app.request(path)
      expect(response.status).toBe(500)
    })
    it('Maps APIキーだけが未設定で経路が必要なら500を返す', async () => {
      mockProviders()
      const response = await app.request(path, undefined, {
        GOOGLE_PLACES_API_KEY: 'test-google-key',
      })
      expect(response.status).toBe(500)
    })

    it.each([
      ['座標なし', null],
      ['緯度が範囲外', { latitude: 91, longitude: 136 }],
      ['経度が範囲外', { latitude: 35, longitude: 181 }],
    ])('%sの候補はRoutesを呼ばずnearby保持・free-time除外する', async (_name, location) => {
      let routeRequests = 0
      const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const hostname = new URL(String(input)).hostname
        if (hostname === 'api.open-meteo.com') {
          return Response.json({
            current: { temperature_2m: 20, weather_code: 3, precipitation: 0 },
          })
        }
        if (hostname === 'places.googleapis.com') {
          return Response.json({
            places: [{
              id: 'invalid-location',
              displayName: { text: '座標不明の候補' },
              types: ['cafe'],
              location,
            }],
          })
        }
        if (hostname === 'routes.googleapis.com') routeRequests += 1
        throw new Error('Routes should not be requested')
      })
      vi.stubGlobal('fetch', fetchMock)
      const placesOnlyEnv = { GOOGLE_PLACES_API_KEY: 'test-google-key' }

      const nearby = await app.request(path, undefined, placesOnlyEnv)
      expect(nearby.status).toBe(200)
      expect(await nearby.json()).toMatchObject({
        places: [{ distance: null, walkingDistanceMeters: null, walkingDurationSeconds: null }],
      })

      const freeTime = await app.request(
        path.replace('mode=nearby', 'mode=free-time&duration=60'),
        undefined,
        placesOnlyEnv,
      )
      expect(freeTime.status).toBe(200)
      expect(await freeTime.json()).toMatchObject({ places: [] })
      expect(routeRequests).toBe(0)
    })

    it('Routesは最大4件ずつ開始し、解決後に残りを開始する', async () => {
      const routeResolvers: Array<() => void> = []
      let activeRoutes = 0
      let maximumActiveRoutes = 0
      const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
        const hostname = new URL(String(input)).hostname
        if (hostname === 'api.open-meteo.com') {
          return Promise.resolve(Response.json({
            current: { temperature_2m: 20, weather_code: 3, precipitation: 0 },
          }))
        }
        if (hostname === 'places.googleapis.com') {
          return Promise.resolve(Response.json({
            places: Array.from({ length: 5 }, (_, index) => ({
              id: `place-${index}`,
              displayName: { text: `施設${index}` },
              types: ['cafe'],
              location: { latitude: 35.171 + index / 1000, longitude: 136.882 },
            })),
          }))
        }
        if (hostname === 'routes.googleapis.com') {
          activeRoutes += 1
          maximumActiveRoutes = Math.max(maximumActiveRoutes, activeRoutes)
          return new Promise<Response>((resolve) => {
            routeResolvers.push(() => {
              activeRoutes -= 1
              resolve(Response.json({ routes: [{ distanceMeters: 320, duration: '300s' }] }))
            })
          })
        }
        return Promise.reject(new Error('Unexpected fetch'))
      })
      vi.stubGlobal('fetch', fetchMock)

      const responsePromise = app.request(path, undefined, env)
      await vi.waitFor(() => expect(routeResolvers).toHaveLength(4))
      expect(maximumActiveRoutes).toBe(4)

      routeResolvers.shift()?.()
      await vi.waitFor(() => expect(routeResolvers).toHaveLength(4))
      expect(maximumActiveRoutes).toBe(4)

      while (routeResolvers.length > 0) routeResolvers.shift()?.()
      const response = await responsePromise
      expect(response.status).toBe(200)
      expect((await response.json()).places).toHaveLength(5)
    })

    it('最初のRoutes失敗後に未着手候補のRoutesを開始しない', async () => {
      const routeResolvers: Array<() => void> = []
      let routeRequests = 0
      const fetchMock = vi.fn<typeof fetch>().mockImplementation((input, init) => {
        const hostname = new URL(String(input)).hostname
        if (hostname === 'api.open-meteo.com') {
          return Promise.resolve(Response.json({
            current: { temperature_2m: 20, weather_code: 3, precipitation: 0 },
          }))
        }
        if (hostname === 'places.googleapis.com') {
          return Promise.resolve(Response.json({
            places: Array.from({ length: 5 }, (_, index) => ({
              id: `place-${index}`,
              displayName: { text: `施設${index}` },
              types: ['cafe'],
              location: { latitude: 35.171 + index / 1000, longitude: 136.882 },
            })),
          }))
        }
        if (hostname === 'routes.googleapis.com') {
          routeRequests += 1
          return new Promise<Response>((resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted', 'AbortError'))
            }, { once: true })
            routeResolvers.push(() => resolve(new Response(null, { status: 503 })))
          })
        }
        return Promise.reject(new Error('Unexpected fetch'))
      })
      vi.stubGlobal('fetch', fetchMock)

      const responsePromise = app.request(path, undefined, env)
      await vi.waitFor(() => expect(routeResolvers).toHaveLength(4))
      routeResolvers.shift()?.()

      const response = await responsePromise
      expect(response.status).toBe(502)
      expect(routeRequests).toBe(4)
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
        { GOOGLE_PLACES_API_KEY: 'test-google-key', GOOGLE_MAPS_API_KEY: 'test-maps-key' },
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
        if (hostname === 'routes.googleapis.com') return Response.json({ routes: [{ distanceMeters: 320, duration: '300s' }] })
        throw new Error('Unexpected fetch')
      })
      vi.stubGlobal('fetch', fetchMock)

      const response = await app.request(
        '/api/search?lat=' + lat + '&lng=' + lng + '&mode=nearby&radius=50000',
        undefined,
        { GOOGLE_PLACES_API_KEY: 'test-google-key', GOOGLE_MAPS_API_KEY: 'test-maps-key' },
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        places: [{ id: 'place-1', rating: 4.2, distance: expected }],
      })
    })
  })
})
