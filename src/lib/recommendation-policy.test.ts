import { describe, expect, it } from 'vitest'
import { evaluateRecommendation, minimumStayMinutesForCategory, walkingMinutesFromSeconds } from './recommendation-policy'

const destination = { lat: 35.1709, lng: 136.8815 }
const route = (durationSeconds: number) => ({ distanceMeters: 320, durationSeconds })

describe('recommendation policy', () => {
  it.each([[0, 0], [1, 1], [59, 1], [60, 1], [61, 2]])(
    'uses the same conservative whole-minute value for %is',
    (seconds, minutes) => {
      expect(walkingMinutesFromSeconds(seconds)).toBe(minutes)
      expect(evaluateRecommendation({ mode: 'free-time', destination, route: route(seconds), freeTimeMinutes: 60 }))
        .toEqual({ eligible: true, walkingMinutes: minutes, availableStayMinutes: 60 - minutes * 2 })
    },
  )

  it('includes exactly 15 walking minutes and excludes one second beyond it', () => {
    expect(evaluateRecommendation({ mode: 'nearby', destination, route: route(900), walkingLimitMinutes: 15 }))
      .toMatchObject({ eligible: true, walkingMinutes: 15 })
    expect(evaluateRecommendation({ mode: 'nearby', destination, route: route(901), walkingLimitMinutes: 15 }))
      .toEqual({ eligible: false, reason: 'outside-walk-limit' })
  })

  it.each([[15, 300, 5, 'park'], [30, 300, 20, undefined], [60, 300, 50, undefined], [120, 300, 110, undefined], [180, 300, 170, undefined], [60, 738, 34, undefined]])(
    'uses round-trip walking time for %imin with a %is route',
    (freeTimeMinutes, seconds, expectedStay, placeCategory) => {
      expect(evaluateRecommendation({ mode: 'free-time', destination, route: route(seconds), freeTimeMinutes, placeCategory }))
        .toEqual({ eligible: true, walkingMinutes: Math.ceil(seconds / 60), availableStayMinutes: expectedStay })
    },
  )

  it.each([
    ['food', 30],
    ['cafe', 15],
    ['park', 5],
    ['shopping', 15],
    [undefined, 15],
    [null, 15],
  ])('uses a %imin minimum stay for actual category %s', (category, expectedMinutes) => {
    expect(minimumStayMinutesForCategory(category)).toBe(expectedMinutes)
  })

  it.each([
    ['food', 31, 59, 29, false],
    ['food', 32, 59, 30, true],
    ['food', 33, 59, 31, true],
    ['cafe', 16, 59, 14, false],
    ['cafe', 17, 59, 15, true],
    ['cafe', 18, 59, 16, true],
    ['park', 6, 59, 4, false],
    ['park', 7, 59, 5, true],
    ['park', 8, 59, 6, true],
    [undefined, 16, 59, 14, false],
    [undefined, 17, 59, 15, true],
    [undefined, 18, 59, 16, true],
  ] as const)('requires the category minimum at the rounded walking boundary', (placeCategory, freeTimeMinutes, seconds, expectedStay, eligible) => {
    const decision = evaluateRecommendation({
      mode: 'free-time', destination, route: route(seconds), placeCategory, freeTimeMinutes,
    })
    if (!eligible) {
      expect(decision).toEqual({ eligible: false, reason: 'insufficient-free-time' })
      return
    }
    expect(decision).toEqual({ eligible: true, walkingMinutes: 1, availableStayMinutes: expectedStay })
  })

  it.each([[15, 480], [30, 900]])(
    'excludes a free-time result when round-trip walking leaves less than the category minimum',
    (freeTimeMinutes, seconds) => {
      expect(evaluateRecommendation({ mode: 'free-time', destination, route: route(seconds), freeTimeMinutes }))
        .toEqual({ eligible: false, reason: 'insufficient-free-time' })
    },
  )

  it.each(['nearby', 'free-time'] as const)('requires a confirmed walking route in %s mode', (mode) => {
    expect(evaluateRecommendation({ mode, destination, route: undefined, walkingLimitMinutes: 15, freeTimeMinutes: 60 }))
      .toEqual({ eligible: false, reason: 'route-unavailable' })
  })

  it('rejects invalid route data and a destination without valid coordinates', () => {
    expect(evaluateRecommendation({ mode: 'nearby', destination, route: route(-1), walkingLimitMinutes: 15 }))
      .toEqual({ eligible: false, reason: 'route-unavailable' })
    expect(evaluateRecommendation({ mode: 'nearby', destination: null, route: route(300), walkingLimitMinutes: 15 }))
      .toEqual({ eligible: false, reason: 'invalid-destination' })
  })
})
