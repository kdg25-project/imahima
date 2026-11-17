import { describe, expect, it } from 'vitest'
import { rankPlaces, type Route, type Weather } from './search-ranking'

const neutralWeather: Weather = {
  temperature: 20,
  weatherCode: 3,
  precipitation: 0,
}

function place(overrides: Record<string, unknown> = {}) {
  return {
    id: 'place-a',
    name: 'テスト施設',
    category: 'food',
    location: { lat: 35, lng: 136 },
    rating: 4.2,
    openNow: true,
    photos: [],
    distance: 420,
    ...overrides,
  }
}

function rank(
  places = [place()],
  routes: Route[] = [{ distanceMeters: 500, durationSeconds: 480 }],
  weather = neutralWeather,
  options: Partial<{ mode: 'nearby' | 'free-time'; category: string; duration: number }> = {},
) {
  return rankPlaces({
    places,
    routes,
    weather,
    mode: options.mode ?? 'nearby',
    category: options.category ?? 'any',
    duration: options.duration,
  })
}

describe('rankPlaces', () => {
  it('承認済みのfree-time計算例を小数第2位で返す', () => {
    const result = rank(
      [place()],
      [{ distanceMeters: 500, durationSeconds: 480 }],
      { temperature: 20, weatherCode: 61, precipitation: 0 },
      { mode: 'free-time', category: 'food', duration: 60 },
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      score: 88.67,
      walkingDistanceMeters: 500,
      walkingDurationSeconds: 480,
      availableStayMinutes: 44,
    })
    expect(result[0].reasons).toContain('往復は片道徒歩時間の2倍で見積もり、現地で過ごせる目安 44分')
  })

  it('free-timeでは経路なし、滞在時間不足を除外し、等号は採用する', () => {
    expect(rank([place()], [null], neutralWeather, { mode: 'free-time', duration: 60 })).toEqual([])
    expect(rank([place()], [{ distanceMeters: 1, durationSeconds: 1 }], neutralWeather, { mode: 'free-time', duration: 31 })).toEqual([])

    const equal = rank(
      [place()],
      [{ distanceMeters: 1, durationSeconds: 1 }],
      neutralWeather,
      { mode: 'free-time', duration: 32 },
    )
    expect(equal).toHaveLength(1)
    expect(equal[0].availableStayMinutes).toBe(30)
  })

  it('nearbyはdurationを使わず、経路なしをnullとして保持する', () => {
    const result = rank([place({ location: null, distance: null })], [null], neutralWeather, {
      mode: 'nearby',
      duration: 1,
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      walkingDistanceMeters: null,
      walkingDurationSeconds: null,
      availableStayMinutes: null,
    })
  })

  it.each([
    ['WMO 97をwetとして、foodに+15', 'food', { temperature: 20, weatherCode: 97, precipitation: 0 }, 15],
    ['降水を未知コードより優先してwetとして、foodに+15', 'food', { temperature: 35, weatherCode: 999, precipitation: 0.1 }, 15],
    ['30℃をhotとして、foodに+10', 'food', { temperature: 30, weatherCode: 3, precipitation: 0 }, 10],
    ['晴天をparkに+10', 'park', { temperature: 20, weatherCode: 1, precipitation: 0 }, 10],
    ['wetをparkに-15', 'park', { temperature: 20, weatherCode: 61, precipitation: 0 }, -15],
    ['mixedカテゴリを中立', 'shopping', { temperature: 20, weatherCode: 61, precipitation: 0 }, 0],
  ] as const)('%s', (_name, category, weather, expectedAdjustment) => {
    const result = rank([place({ category, distance: null, rating: null, openNow: false })], [null], weather)
    expect(result[0].score).toBe(expectedAdjustment)
  })

  it('返却score、徒歩秒、直線距離、id codepoint、元順で安定して並べる', () => {
    const results = rank(
      [
        place({ id: 'z', distance: 500 }),
        place({ id: 'a', distance: 500 }),
        place({ id: null, distance: 500 }),
        place({ id: 'same', distance: 500 }),
        place({ id: 'same', distance: 500 }),
      ],
      [
        { distanceMeters: 1, durationSeconds: 300 },
        { distanceMeters: 1, durationSeconds: 300 },
        { distanceMeters: 1, durationSeconds: 300 },
        { distanceMeters: 1, durationSeconds: 240 },
        { distanceMeters: 1, durationSeconds: 240 },
      ],
    )
    expect(results.map((result) => result.id)).toEqual(['same', 'same', 'a', 'z', null])
  })
})
