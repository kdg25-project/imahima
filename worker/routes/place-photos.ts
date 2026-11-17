import { Hono } from 'hono'

type Bindings = {
  GOOGLE_PLACES_API_KEY?: string
  // Kept for projects that configured the earlier Places routes with this name.
  GOOGLE_MAPS_API_KEY?: string
}

type GooglePhotoMediaResponse = {
  name: string
  photoUri: string
}

const photoResourceName = /^places\/[A-Za-z0-9._~-]+\/photos\/[A-Za-z0-9._~-]+$/
const maxPhotoDimension = 4800

function isGooglePhotoUri(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.port === '' &&
      (url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com'))
    )
  } catch {
    return false
  }
}

function isMediaResponse(value: unknown): value is GooglePhotoMediaResponse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.name === 'string' && typeof record.photoUri === 'string'
}

function isRedirect(response: Response) {
  return response.status >= 300 && response.status < 400
}

async function fetchGoogleImage(photoUri: string): Promise<Response | undefined> {
  try {
    // Cloudflare Workers supports manual redirect handling, but not redirect: 'error'.
    // This request never follows a redirect or includes the Places API key.
    return await fetch(photoUri, { redirect: 'manual' })
  } catch {
    return undefined
  }
}

function errorResponse(message: string, status: 400 | 404 | 500 | 502) {
  return Response.json({ error: message }, { status })
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const name = c.req.query('name')
  const maxWidthPxValue = c.req.query('maxWidthPx') ?? '800'

  if (!name || !photoResourceName.test(name)) {
    return errorResponse('Invalid photo name', 400)
  }

  if (!/^[1-9]\d*$/.test(maxWidthPxValue)) {
    return errorResponse('Invalid maxWidthPx', 400)
  }

  const maxWidthPx = Number(maxWidthPxValue)
  if (!Number.isSafeInteger(maxWidthPx) || maxWidthPx > maxPhotoDimension) {
    return errorResponse('Invalid maxWidthPx', 400)
  }

  const apiKey = c.env.GOOGLE_PLACES_API_KEY ?? c.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return errorResponse('Photo service is not configured', 500)
  }

  const mediaUrl = new URL(`https://places.googleapis.com/v1/${name}/media`)
  mediaUrl.searchParams.set('maxWidthPx', String(maxWidthPx))
  mediaUrl.searchParams.set('skipHttpRedirect', 'true')

  let mediaResponse: Response
  try {
    mediaResponse = await fetch(mediaUrl, {
      headers: { 'X-Goog-Api-Key': apiKey },
      // Workers does not implement redirect: 'error'. Manual mode prevents
      // redirect following and lets the status check below reject it safely.
      redirect: 'manual',
    })
  } catch {
    return errorResponse('Failed to fetch photo', 502)
  }

  if (mediaResponse.status === 404) {
    return errorResponse('Photo not found', 404)
  }
  if (!mediaResponse.ok || isRedirect(mediaResponse)) {
    return errorResponse('Failed to fetch photo', 502)
  }

  let media: GooglePhotoMediaResponse
  try {
    const decoded: unknown = await mediaResponse.json()
    if (!isMediaResponse(decoded) || !isGooglePhotoUri(decoded.photoUri)) {
      return errorResponse('Failed to fetch photo', 502)
    }
    media = decoded
  } catch {
    return errorResponse('Failed to fetch photo', 502)
  }

  const imageResponse = await fetchGoogleImage(media.photoUri)
  if (!imageResponse) {
    return errorResponse('Failed to fetch photo', 502)
  }

  if (imageResponse.status === 404) {
    return errorResponse('Photo not found', 404)
  }
  const contentType = imageResponse.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (isRedirect(imageResponse) || !imageResponse.ok || !contentType || !contentType.startsWith('image/') || contentType === 'image/svg+xml' || !imageResponse.body) {
    return errorResponse('Failed to fetch photo', 502)
  }

  return new Response(imageResponse.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})

export default app
