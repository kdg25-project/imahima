import type { Coordinates, WalkingRoute } from './api'

export type RecommendationMode = 'nearby' | 'free-time'

export type RecommendationDecision =
  | { eligible: true; walkingMinutes: number; availableStayMinutes?: number }
  | {
    eligible: false
    reason: 'invalid-destination' | 'route-unavailable' | 'outside-walk-limit' | 'insufficient-free-time'
  }

export function hasValidCoordinates(value: Coordinates | null | undefined): value is Coordinates {
  return value !== null && value !== undefined &&
    Number.isFinite(value.lat) && value.lat >= -90 && value.lat <= 90 &&
    Number.isFinite(value.lng) && value.lng >= -180 && value.lng <= 180
}

export function walkingMinutesFromSeconds(durationSeconds: number) {
  return Math.ceil(durationSeconds / 60)
}

export function minimumStayMinutesForCategory(category: string | null | undefined) {
  // Apply the recommendation rule to the normalized actual place category,
  // rather than the search chip that happened to return it.
  if (category === 'food') return 30
  if (category === 'cafe') return 15
  if (category === 'park') return 5
  return 15
}

export function hasConfirmedWalkingRoute(route: WalkingRoute | null | undefined): route is WalkingRoute {
  return route !== null && route !== undefined &&
    Number.isFinite(route.distanceMeters) && route.distanceMeters >= 0 &&
    Number.isFinite(route.durationSeconds) && route.durationSeconds >= 0
}

/**
 * Applies the user-visible recommendation constraints to a route that was
 * returned by Routes API.  A missing or malformed route is never treated as a
 * nearby result: straight-line distance is not a substitute for walking time.
 */
export function evaluateRecommendation({
  mode,
  destination,
  route,
  placeCategory,
  walkingLimitMinutes,
  freeTimeMinutes,
}: {
  mode: RecommendationMode
  destination: Coordinates | null | undefined
  route: WalkingRoute | null | undefined
  placeCategory?: string | null
  walkingLimitMinutes?: number
  freeTimeMinutes?: number
}): RecommendationDecision {
  if (!hasValidCoordinates(destination)) {
    return { eligible: false, reason: 'invalid-destination' }
  }
  if (!hasConfirmedWalkingRoute(route)) {
    return { eligible: false, reason: 'route-unavailable' }
  }

  const walkingMinutes = walkingMinutesFromSeconds(route.durationSeconds)
  if (mode === 'nearby') {
    if (walkingLimitMinutes !== undefined && walkingMinutes > walkingLimitMinutes) {
      return { eligible: false, reason: 'outside-walk-limit' }
    }
    return { eligible: true, walkingMinutes }
  }

  if (freeTimeMinutes === undefined) return { eligible: true, walkingMinutes }
  const availableStayMinutes = freeTimeMinutes - walkingMinutes * 2
  if (availableStayMinutes < minimumStayMinutesForCategory(placeCategory)) {
    return { eligible: false, reason: 'insufficient-free-time' }
  }
  return { eligible: true, walkingMinutes, availableStayMinutes }
}
