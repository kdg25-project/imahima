import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import app from '../index'

describe('GET /api/places', () => {
  const fetchMock = vi.fn<typeof fetch>()
  const validPath = '/api/places?lat=35.1709&lng=136.8815'
  const env = { GOOGLE_PLACES_API_KEY: 'test-google-key' }

  const photo = {
    name: 'places/place-1/photos/photo-1',
    widthPx: 800,
    heightPx: 600,
    authorAttributions: [
      { displayName: '撮影者', uri: 'https://example.com/author' },
    ],
  }

  const googlePlace = {
    id: 'place-1',
    displayName: { text: 'テストカフェ' },
    types: ['cafe'],
    location: { latitude: 35.1709, longitude: 136.8815 },
    rating: 4.2,
    currentOpeningHours: { openNow: false },
    photos: [photo],
    formattedAddress: 'レスポンスには含めない住所',
  }

  function request(path = validPath) {
    return app.request(path, undefined, env)
  }

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(
      Response.json({ places: [googlePlace] }),
    )
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('取得した場所をアプリ向けに整形して返す', async () => {
    const response = await request(
      validPath + '&category=cafe&radius=1500',
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')

    const result = await response.json()

    expect(result).toEqual({
      places: [
        {
          id: 'place-1',
          name: 'テストカフェ',
          category: 'cafe',
          location: { lat: 35.1709, lng: 136.8815 },
          rating: 4.2,
          openNow: false,
          photos: [photo],
        },
      ],
    })
    expect(JSON.stringify(result)).not.toContain(env.GOOGLE_PLACES_API_KEY)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const call = fetchMock.mock.calls[0]
    const options = call?.[1]
    const headers = new Headers(options?.headers)

    expect(call?.[0]).toBe(
      'https://places.googleapis.com/v1/places:searchNearby',
    )
    expect(options?.method).toBe('POST')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-Goog-Api-Key')).toBe(env.GOOGLE_PLACES_API_KEY)
    expect(headers.get('X-Goog-FieldMask')).toContain('places.id')
    expect(headers.get('X-Goog-FieldMask')).not.toContain('*')
    expect(JSON.parse(String(options?.body))).toMatchObject({
      includedTypes: ['cafe'],
      locationRestriction: {
        circle: {
          center: { latitude: 35.1709, longitude: 136.8815 },
          radius: 1500,
        },
      },
    })
  })

  it.each([
    ['cafe', ['cafe']],
    ['food', ['restaurant']],
    ['shopping', ['shopping_mall', 'department_store']],
    ['entertainment', ['amusement_center', 'amusement_park', 'movie_theater']],
    ['sightseeing', ['tourist_attraction', 'museum']],
    ['park', ['park']],
    ['study', ['library', 'cafe']],
    ['rest', ['cafe', 'park']],
  ] as const)('カテゴリ %s をGoogleのタイプに変換する', async (category, types) => {
    const response = await request(validPath + '&category=' + category)
    const options = fetchMock.mock.calls[0]?.[1]

    expect(response.status).toBe(200)
    expect(JSON.parse(String(options?.body)).includedTypes).toEqual(types)
    expect(await response.json()).toMatchObject({
      places: [{ category }],
    })
  })

  it('省略時はカテゴリを絞らず半径1000mで検索する', async () => {
    const response = await request()
    const options = fetchMock.mock.calls[0]?.[1]
    const body = JSON.parse(String(options?.body))

    expect(response.status).toBe(200)
    expect(body).not.toHaveProperty('includedTypes')
    expect(body.locationRestriction.circle.radius).toBe(1000)
    expect(await response.json()).toMatchObject({
      places: [{ category: 'cafe' }],
    })
  })

  it.each([
    '/api/places?lat=0&lng=0',
    '/api/places?lat=-90&lng=-180',
    '/api/places?lat=90&lng=180',
  ])('範囲内の座標を受け付ける: %s', async (path) => {
    const response = await request(path)

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([1, 50000])('半径 %i mを受け付ける', async (radius) => {
    const response = await request(validPath + '&radius=' + radius)

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    '/api/places',
    '/api/places?lat=35',
    '/api/places?lng=136',
    '/api/places?lat=&lng=136',
    '/api/places?lat=35&lng=',
    '/api/places?lat=%20&lng=136',
    '/api/places?lat=35&lng=%20',
    '/api/places?lat=abc&lng=136',
    '/api/places?lat=35&lng=abc',
    '/api/places?lat=NaN&lng=136',
    '/api/places?lat=Infinity&lng=136',
    '/api/places?lat=91&lng=136',
    '/api/places?lat=-91&lng=136',
    '/api/places?lat=35&lng=181',
    '/api/places?lat=35&lng=-181',
    validPath + '&radius=',
    validPath + '&radius=%20',
    validPath + '&radius=abc',
    validPath + '&radius=Infinity',
    validPath + '&radius=0',
    validPath + '&radius=-1',
    validPath + '&radius=50001',
    validPath + '&category=unknown',
    validPath + '&category=__proto__',
  ])('不正な入力では通信せず400を返す: %s', async (path) => {
    const response = await request(path)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: expect.any(String),
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('任意項目がない場合はnull、写真なしは空配列を返す', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        places: [
          {
            id: 'place-2',
            displayName: { text: 'スポット' },
            location: { latitude: 35.17, longitude: 136.88 },
          },
        ],
      }),
    )

    const response = await request()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      places: [
        {
          id: 'place-2',
          name: 'スポット',
          category: null,
          location: { lat: 35.17, lng: 136.88 },
          rating: null,
          openNow: null,
          photos: [],
        },
      ],
    })
  })

  it.each([
    { body: {} },
    { body: { places: [] } },
  ])('検索結果0件を空配列で返す: %#', async ({ body }) => {
    fetchMock.mockResolvedValue(Response.json(body))

    const response = await request()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ places: [] })
  })

  it('APIキー未設定では通信せず500を返す', async () => {
    const response = await app.request(validPath)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Internal Server Error',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([400, 403, 429, 500, 503])(
    'Googleが%iを返した場合は502を返す',
    async (status) => {
      fetchMock.mockResolvedValue(new Response(null, { status }))

      const response = await request()

      expect(response.status).toBe(502)
      expect(await response.json()).toEqual({
        error: 'Failed to fetch places',
      })
    },
  )

  it('通信失敗時は502を返す', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'))

    const response = await request()

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      error: 'Failed to fetch places',
    })
  })

  it('GoogleのレスポンスがJSONでない場合は502を返す', async () => {
    fetchMock.mockResolvedValue(new Response('not json'))

    const response = await request()

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      error: 'Failed to fetch places',
    })
  })

  it.each([
    { body: null },
    { body: [] },
    { body: { places: null } },
    { body: { places: {} } },
  ])('不正なレスポンス形式では502を返す: %#', async ({ body }) => {
    fetchMock.mockResolvedValue(Response.json(body))

    const response = await request()

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      error: 'Failed to fetch places',
    })
  })
})