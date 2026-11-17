import type { PlaceResult } from '../routes/places'

export type Weather = {
  temperature: number
  weatherCode: number
  precipitation: number
}

export type Route = {
  distanceMeters: number
  durationSeconds: number
} | null

export type RankedPlace = PlaceResult & {
  distance: number | null
  walkingDistanceMeters: number | null
  walkingDurationSeconds: number | null
  availableStayMinutes: number | null
  score: number
  reason: string
  reasons: string[]
}

type PlaceWithDistance = PlaceResult & { distance: number | null }
type RankedEntry = { place: RankedPlace; index: number }

const wetCodes = new Set([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82,
  85, 86, 95, 96, 97, 99,
])

const minimumStayMinutes: Record<string, number> = {
  food: 30,
  cafe: 15,
  park: 5,
  shopping: 15,
  entertainment: 15,
  sightseeing: 15,
  study: 15,
  rest: 15,
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value))
}

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100
}

function weatherAdjustment(place: PlaceResult, weather: Weather) {
  const wet = weather.precipitation > 0 || wetCodes.has(weather.weatherCode)
  const hot = !wet && weather.temperature >= 30
  const sunny =
    !wet &&
    !hot &&
    (weather.weatherCode === 0 || weather.weatherCode === 1) &&
    weather.precipitation === 0

  if (['cafe', 'food', 'study'].includes(place.category ?? '')) {
    return wet ? 15 : hot ? 10 : 0
  }
  if (place.category === 'park') {
    return wet ? -15 : hot ? -10 : sunny ? 10 : 0
  }
  return 0
}

function weatherReason(score: number, weather: Weather) {
  if (score === 0) return undefined
  const wet = weather.precipitation > 0 || wetCodes.has(weather.weatherCode)
  const condition = wet ? '雨天' : weather.temperature >= 30 ? '高温' : '晴天'
  return `${condition}を考慮したカテゴリ補正 ${score > 0 ? '+' : ''}${score}点`
}

function compareCodePoints(left: string | null, right: string | null) {
  if (left === right) return 0
  if (left === null) return 1
  if (right === null) return -1
  return left < right ? -1 : 1
}

export function rankPlaces({
  places,
  routes,
  weather,
  mode,
  category,
  duration,
}: {
  places: PlaceWithDistance[]
  routes: Route[]
  weather: Weather
  mode: 'nearby' | 'free-time'
  category: string
  duration?: number
}): RankedPlace[] {
  const ranked: RankedEntry[] = []

  places.forEach((place, index) => {
    const route = routes[index]
    const walkingMinutes = route ? Math.ceil(route.durationSeconds / 60) : null
    const availableStayMinutes =
      mode === 'free-time' && walkingMinutes !== null && duration !== undefined
        ? duration - walkingMinutes * 2
        : null
    const requiredStay = minimumStayMinutes[place.category ?? ''] ?? 15
    if (
      mode === 'free-time' &&
      (walkingMinutes === null ||
        availableStayMinutes === null ||
        availableStayMinutes < requiredStay)
    ) {
      return
    }

    const distanceScore =
      place.distance === null
        ? 0
        : place.distance <= 250
          ? 15
          : place.distance <= 500
            ? 10
            : place.distance <= 1000
              ? 5
              : 0
    const travelTimeScore =
      walkingMinutes === null
        ? 0
        : mode === 'nearby'
          ? 20 * clamp(1 - walkingMinutes / 30)
          : 20 * clamp((duration! - walkingMinutes * 2) / duration!)
    const weatherScore = weatherAdjustment(place, weather)
    const openingScore = place.openNow === true ? 5 : 0
    const ratingScore =
      typeof place.rating === 'number' &&
      Number.isFinite(place.rating) &&
      place.rating >= 0 &&
      place.rating <= 5
        ? Math.floor(place.rating)
        : 0
    const score = roundToTwoDecimals(
      (category === 'any' ? 0 : 40) +
        distanceScore +
        travelTimeScore +
        weatherScore +
        openingScore +
        ratingScore,
    )
    const reasonForWeather = weatherReason(weatherScore, weather)
    const reasons = [
      ...(category !== 'any' ? [`カテゴリ「${category}」で検索`] : []),
      ...(place.distance !== null ? [`直線距離の目安 ${place.distance}m`] : []),
      ...(walkingMinutes !== null ? [`徒歩 ${walkingMinutes}分`] : []),
      ...(availableStayMinutes !== null
        ? [`往復は片道徒歩時間の2倍で見積もり、現地で過ごせる目安 ${availableStayMinutes}分`]
        : []),
      ...(reasonForWeather ? [reasonForWeather] : []),
      ...(place.openNow === true ? ['営業中'] : []),
      ...(ratingScore > 0 ? [`評価 ${place.rating}`] : []),
    ]

    ranked.push({
      place: {
        ...place,
        walkingDistanceMeters: route?.distanceMeters ?? null,
        walkingDurationSeconds: route?.durationSeconds ?? null,
        availableStayMinutes: mode === 'free-time' ? availableStayMinutes : null,
        score,
        reason: reasons.join('、'),
        reasons,
      },
      index,
    })
  })

  return ranked
    .sort(
      (left, right) =>
        right.place.score - left.place.score ||
        (left.place.walkingDurationSeconds ?? Infinity) -
          (right.place.walkingDurationSeconds ?? Infinity) ||
        (left.place.distance ?? Infinity) - (right.place.distance ?? Infinity) ||
        compareCodePoints(left.place.id, right.place.id) ||
        left.index - right.index,
    )
    .map((entry) => entry.place)
}
