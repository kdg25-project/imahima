import { Hono } from 'hono'

type Bindings = {
  GOOGLE_PLACES_API_KEY?: string
}

type AuthorAttribution = {
  displayName?: string
  uri?: string
  photoUri?: string
}

type PlacePhoto = {
  name: string
  widthPx: number
  heightPx: number
  authorAttributions: AuthorAttribution[]
}

type PlaceResult = {
  id: string | null
  name: string | null
  category: string | null
  location: { lat: number; lng: number } | null
  rating: number | null
  openNow: boolean | null
  photos: PlacePhoto[]
}

const CATEGORY_TYPES = {
  cafe: ['cafe'],
  food: ['restaurant'],
  shopping: ['shopping_mall', 'department_store'],
  entertainment: [
    'amusement_center',
    'amusement_park',
    'movie_theater',
  ],
  sightseeing: ['tourist_attraction', 'museum'],
  park: ['park'],
  study: ['library', 'cafe'],
  rest: ['cafe', 'park'],
} as const

function isCategory(
  value: string,
): value is keyof typeof CATEGORY_TYPES {
  return Object.hasOwn(CATEGORY_TYPES, value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalString(value: unknown) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw new Error('Invalid Google Places response')
  return value
}

function optionalFiniteNumber(value: unknown) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Invalid Google Places response')
  }
  return value
}

function optionalBoolean(value: unknown) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'boolean') throw new Error('Invalid Google Places response')
  return value
}

function normalizeAttributions(value: unknown): AuthorAttribution[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new Error('Invalid Google Places response')

  return value.map((attribution) => {
    if (!isRecord(attribution)) throw new Error('Invalid Google Places response')
    const displayName = optionalString(attribution.displayName)
    const uri = optionalString(attribution.uri)
    const photoUri = optionalString(attribution.photoUri)
    return {
      ...(displayName === null ? {} : { displayName }),
      ...(uri === null ? {} : { uri }),
      ...(photoUri === null ? {} : { photoUri }),
    }
  })
}

function normalizePhotos(value: unknown): PlacePhoto[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new Error('Invalid Google Places response')

  return value.map((photo) => {
    if (!isRecord(photo)) throw new Error('Invalid Google Places response')
    const name = optionalString(photo.name)
    const widthPx = optionalFiniteNumber(photo.widthPx)
    const heightPx = optionalFiniteNumber(photo.heightPx)
    if (name === null || widthPx === null || heightPx === null) {
      throw new Error('Invalid Google Places response')
    }
    return {
      name,
      widthPx,
      heightPx,
      authorAttributions: normalizeAttributions(photo.authorAttributions),
    }
  })
}

function normalizePlaces(
  data: unknown,
  category: string | undefined,
): PlaceResult[] {
  if (!isRecord(data)) throw new Error('Invalid Google Places response')
  const rawPlaces = data.places
  if (rawPlaces === undefined) return []
  if (!Array.isArray(rawPlaces)) throw new Error('Invalid Google Places response')

  return rawPlaces.map((place) => {
    if (!isRecord(place)) throw new Error('Invalid Google Places response')

    const id = optionalString(place.id)
    const displayName = place.displayName
    if (displayName !== undefined && displayName !== null && !isRecord(displayName)) {
      throw new Error('Invalid Google Places response')
    }
    const name = displayName === undefined || displayName === null
      ? null
      : optionalString(displayName.text)

    const types = place.types
    if (types !== undefined && types !== null && (!Array.isArray(types) || types.some((type) => typeof type !== 'string'))) {
      throw new Error('Invalid Google Places response')
    }

    const location = place.location
    let normalizedLocation: PlaceResult['location'] = null
    if (location !== undefined && location !== null) {
      if (!isRecord(location)) throw new Error('Invalid Google Places response')
      const lat = optionalFiniteNumber(location.latitude)
      const lng = optionalFiniteNumber(location.longitude)
      if (lat === null || lng === null) throw new Error('Invalid Google Places response')
      normalizedLocation = { lat, lng }
    }

    const openingHours = place.currentOpeningHours
    if (openingHours !== undefined && openingHours !== null && !isRecord(openingHours)) {
      throw new Error('Invalid Google Places response')
    }

    const matchedCategory = Object.entries(CATEGORY_TYPES)
      .find(([, categoryTypes]) =>
        categoryTypes.some((type) => (types ?? []).includes(type)),
      )?.[0]

    return {
      id,
      name,
      category: category ?? matchedCategory ?? null,
      location: normalizedLocation,
      rating: optionalFiniteNumber(place.rating),
      openNow: openingHours === undefined || openingHours === null
        ? null
        : optionalBoolean(openingHours.openNow),
      photos: normalizePhotos(place.photos),
    }
  })
}

const placesRoutes = new Hono<{ Bindings: Bindings }>()

placesRoutes.get('/', async (c) => {
  try {
    const latText = c.req.query('lat')
    const lngText = c.req.query('lng')
    const category = c.req.query('category')
    const radiusText = c.req.query('radius')

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

    if (category !== undefined && !isCategory(category)) {
      return c.json({ error: 'Invalid category' }, 400)
    }

    if (radiusText !== undefined && radiusText.trim() === '') {
      return c.json({ error: 'Invalid radius' }, 400)
    }

    const radius = radiusText === undefined ? 1000 : Number(radiusText)

    if (
      !Number.isFinite(radius) ||
      radius <= 0 ||
      radius > 50000
    ) {
      return c.json({ error: 'Invalid radius' }, 400)
    }

    const apiKey = c.env?.GOOGLE_PLACES_API_KEY

    if (!apiKey) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }

    const requestBody = {
      languageCode: 'ja',
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: {
            latitude: lat,
            longitude: lng,
          },
          radius,
        },
      },
      ...(category !== undefined && isCategory(category)
        ? { includedTypes: CATEGORY_TYPES[category] }
        : {}),
    }

    let places: PlaceResult[]

    try {
      const response = await fetch(
        'https://places.googleapis.com/v1/places:searchNearby',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': [
              'places.id',
              'places.displayName',
              'places.types',
              'places.location',
              'places.rating',
              'places.currentOpeningHours.openNow',
              'places.photos.name',
              'places.photos.widthPx',
              'places.photos.heightPx',
              'places.photos.authorAttributions',
            ].join(','),
          },
          body: JSON.stringify(requestBody),
        },
      )

      if (!response.ok) {
        return c.json({ error: 'Failed to fetch places' }, 502)
      }

      const data: unknown = await response.json()
      places = normalizePlaces(data, category)
    } catch {
      return c.json({ error: 'Failed to fetch places' }, 502)
    }

    return c.json({ places })
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

export default placesRoutes
