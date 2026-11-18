import { afterEach, describe, expect, it, vi } from 'vitest'
import { categoryToApiValue, displayPlaceCategory, formatWalkingDuration, getNearbyPlaces, getPlaceDetails, getWalkingRoute } from './api'
import { hasSearchCoordinates, parseSearchParams } from './search-params'

function json(data: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => data }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('place API helpers', () => {
  it('requests the selected category and accepts only usable nearby places', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ places: [
      { id: 'cafe-1', name: 'カフェ', category: 'cafe', location: { lat: 35.1, lng: 136.1 }, rating: 4.2, openNow: true },
      { id: null, name: '壊れた候補', category: 'cafe', location: { lat: 35.1, lng: 136.1 } },
    ] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getNearbyPlaces({ coordinates: { lat: 35.1, lng: 136.1 }, category: 'cafe' })).resolves.toEqual([
      expect.objectContaining({ id: 'cafe-1', name: 'カフェ' }),
    ])
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('category=cafe')
  })

  it('uses a walking-route POST with only origin and destination coordinates', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ distanceMeters: 320, durationSeconds: 300 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getWalkingRoute({ origin: { lat: 35.1, lng: 136.1 }, destination: { lat: 35.2, lng: 136.2 } })).resolves.toEqual({ distanceMeters: 320, durationSeconds: 300 })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/routes')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ origin: { lat: 35.1, lng: 136.1 }, destination: { lat: 35.2, lng: 136.2 }, travelMode: 'WALK' }) })
  })

  it('times out a stalled walking-route request instead of leaving search loading forever', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    vi.stubGlobal('fetch', fetchMock)

    const route = getWalkingRoute({ origin: { lat: 35.1, lng: 136.1 }, destination: { lat: 35.2, lng: 136.2 } })
    const expectation = expect(route).rejects.toMatchObject({ status: 408 })
    await vi.advanceTimersByTimeAsync(5_000)

    await expectation
  })

  it('keeps place detail fields nullable when upstream data is incomplete', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({
      id: 'place-1',
      name: '施設',
      category: 'food',
      location: { lat: 35.1, lng: 136.1 },
      address: '名古屋市',
      openingHours: ['月曜日: 9:00～18:00', 42],
      todayOpeningHours: '9:00～18:00',
      budget: '￥1,000〜￥2,000',
    })))
    await expect(getPlaceDetails('place-1')).resolves.toMatchObject({
      id: 'place-1',
      name: '施設',
      address: '名古屋市',
      rating: null,
      openNow: null,
      openingHours: ['月曜日: 9:00～18:00'],
      todayOpeningHours: '9:00～18:00',
      budget: '￥1,000〜￥2,000',
    })
  })

  it('uses the validated detail app category while accepting legacy raw categories', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({
        id: 'park', name: '公園', category: 'tourist_attraction', appCategory: 'park', location: { lat: 35.1, lng: 136.1 }, address: '名古屋市',
      }))
      .mockResolvedValueOnce(json({
        id: 'legacy', name: '旧形式', category: 'food', location: { lat: 35.1, lng: 136.1 }, address: '名古屋市',
      }))
      .mockResolvedValueOnce(json({
        id: 'invalid-app-category', name: '不正形式', category: 'food', appCategory: 'unknown', location: { lat: 35.1, lng: 136.1 }, address: '名古屋市',
      }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getPlaceDetails('park')).resolves.toMatchObject({ category: 'park' })
    await expect(getPlaceDetails('legacy')).resolves.toMatchObject({ category: 'food' })
    await expect(getPlaceDetails('invalid-app-category')).resolves.toMatchObject({ category: 'food' })
  })

  it.each([
    [0, '徒歩0分'],
    [1, '徒歩1分'],
    [59, '徒歩1分'],
    [60, '徒歩1分'],
    [61, '徒歩2分'],
  ])('displays the same conservative walking minutes used by recommendations for %is', (seconds, label) => {
    expect(formatWalkingDuration(seconds)).toBe(label)
  })
})

describe('search parameter parsing', () => {
  it('maps the visible exercise category to its dedicated API category', () => {
    expect(categoryToApiValue('運動')).toBe('exercise')
    expect(displayPlaceCategory('fitness_center')).toBe('運動')
    expect(displayPlaceCategory('bakery')).toBe('ごはん')
    expect(displayPlaceCategory('athletic_field')).toBe('運動')
    expect(displayPlaceCategory('カフェ')).toBe('カフェ')
  })

  it('rejects invalid coordinates while preserving valid favorites return context', () => {
    const invalid = parseSearchParams({ lat: 'not-a-number', lng: 136.1, from: 'favorites' })
    expect(hasSearchCoordinates(invalid)).toBe(false)
    expect(invalid.from).toBe('favorites')

    const valid = parseSearchParams({ lat: 35.1, lng: 136.1, mode: 'free-time', freeTime: 60 })
    expect(hasSearchCoordinates(valid)).toBe(true)
    if (hasSearchCoordinates(valid)) expect(valid).toMatchObject({ lat: 35.1, lng: 136.1, mode: 'free-time', freeTime: 60 })
  })
})
