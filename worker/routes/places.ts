import { Hono } from 'hono'

type Bindings = {
  GOOGLE_PLACES_API_KEY?: string
}

type GooglePlace = {
  id?: string
  displayName?: {
    text?: string
  }
  types?: string[]
  location?: {
    latitude: number
    longitude: number
  }
  rating?: number
  currentOpeningHours?: {
    openNow?: boolean
  }
  photos?: {
    name: string
    widthPx: number
    heightPx: number
    authorAttributions?: {
      displayName?: string
      uri?: string
      photoUri?: string
    }[]
  }[]
}

type GoogleNearbyResponse = {
  places?: GooglePlace[]
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

    let data: GoogleNearbyResponse

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

      data = (await response.json()) as GoogleNearbyResponse

      if (
        data === null ||
        typeof data !== 'object' ||
        Array.isArray(data) ||
        (
          data.places !== undefined &&
          !Array.isArray(data.places)
        )
      ) {
        return c.json({ error: 'Failed to fetch places' }, 502)
      }
    } catch {
      return c.json({ error: 'Failed to fetch places' }, 502)
    }

    const places = (data.places ?? []).map((place) => {
      const matchedCategory = Object.entries(CATEGORY_TYPES)
        .find(([, types]) =>
          types.some((type) =>
            (place.types ?? []).includes(type),
          ),
        )?.[0]

      return {
        id: place.id ?? null,
        name: place.displayName?.text ?? null,
        category: category ?? matchedCategory ?? null,
        location: place.location
          ? {
              lat: place.location.latitude,
              lng: place.location.longitude,
            }
          : null,
        rating: place.rating ?? null,
        openNow: place.currentOpeningHours?.openNow ?? null,
        photos: (place.photos ?? []).map((photo) => ({
          name: photo.name,
          widthPx: photo.widthPx,
          heightPx: photo.heightPx,
          authorAttributions: photo.authorAttributions ?? [],
        })),
      }
    })

    return c.json({ places })
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

export default placesRoutes