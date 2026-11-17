import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import app from '../index'

describe('GET /api/place-photos', () => {
  const fetchMock = vi.fn<typeof fetch>()
  const env = { GOOGLE_PLACES_API_KEY: 'test-server-key' }
  const name = 'places/place-1/photos/photo-1'

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('validates Google media then streams a safe image without exposing the API key', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({
        name: `${name}/media`,
        photoUri: 'https://lh3.googleusercontent.com/a-safe-photo',
      }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'image/jpeg; charset=binary' },
      }))

    const response = await app.request(`/api/place-photos?name=${encodeURIComponent(name)}&maxWidthPx=800`, undefined, env)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([1, 2, 3])
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const [mediaUrl, mediaInit] = fetchMock.mock.calls[0] ?? []
    expect(String(mediaUrl)).toBe(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=800&skipHttpRedirect=true`)
    expect(new Headers(mediaInit?.headers).get('X-Goog-Api-Key')).toBe(env.GOOGLE_PLACES_API_KEY)
    expect(mediaInit?.redirect).toBe('manual')

    const [imageUrl, imageInit] = fetchMock.mock.calls[1] ?? []
    expect(imageUrl).toBe('https://lh3.googleusercontent.com/a-safe-photo')
    expect(imageInit).toEqual({ redirect: 'manual' })
    expect(response.headers.get('x-goog-api-key')).toBeNull()
  })

  it.each([
    '/api/place-photos',
    '/api/place-photos?name=places/place-1/photos/../secret',
    '/api/place-photos?name=places/place-1/photos/photo-1&maxWidthPx=0',
    '/api/place-photos?name=places/place-1/photos/photo-1&maxWidthPx=4801',
    '/api/place-photos?name=places/place-1/photos/photo-1&maxWidthPx=1.5',
  ])('rejects invalid input before making an upstream request: %s', async (path) => {
    const response = await app.request(path, undefined, env)

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not proxy untrusted or malformed media responses', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ name: `${name}/media`, photoUri: 'https://example.com/photo.jpg' }))

    const response = await app.request(`/api/place-photos?name=${encodeURIComponent(name)}`, undefined, env)

    expect(response.status).toBe(502)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('handles a network failure without exposing the server key', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('redirect disallowed'))

    const response = await app.request(`/api/place-photos?name=${encodeURIComponent(name)}`, undefined, env)

    expect(response.status).toBe(502)
    expect(JSON.stringify(await response.json())).not.toContain(env.GOOGLE_PLACES_API_KEY)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ redirect: 'manual' }),
    )
  })

  it.each([301, 302, 307, 308])('rejects a metadata redirect (%i) without following it or exposing the server key', async (status) => {
    fetchMock.mockResolvedValueOnce(new Response(null, {
      status,
      headers: { Location: 'https://lh3.googleusercontent.com/redirect-target' },
    }))

    const response = await app.request(`/api/place-photos?name=${encodeURIComponent(name)}`, undefined, env)

    expect(response.status).toBe(502)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] ?? []
    expect(init?.redirect).toBe('manual')
    expect(new Headers(init?.headers).get('X-Goog-Api-Key')).toBe(env.GOOGLE_PLACES_API_KEY)
  })

  it.each([301, 302, 307, 308])('rejects a media redirect (%i) without following it or forwarding the server key', async (status) => {
    fetchMock
      .mockResolvedValueOnce(Response.json({
        name: `${name}/media`,
        photoUri: 'https://lh3.googleusercontent.com/a-safe-photo',
      }))
      .mockResolvedValueOnce(new Response(null, {
        status,
        headers: { Location: 'https://lh4.googleusercontent.com/redirect-target' },
      }))

    const response = await app.request(`/api/place-photos?name=${encodeURIComponent(name)}`, undefined, env)

    expect(response.status).toBe(502)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, init] = fetchMock.mock.calls[1] ?? []
    expect(init).toEqual({ redirect: 'manual' })
    expect(new Headers(init?.headers).get('X-Goog-Api-Key')).toBeNull()
  })

  it.each([
    new Response('upstream unavailable', { status: 503 }),
    new Response('{', { status: 200 }),
    Response.json({ name: `${name}/media`, photoUri: 'https://lh3.googleusercontent.com/a-safe-photo' }),
  ])('returns 502 for invalid Google/image upstream responses', async (mediaResponse) => {
    fetchMock.mockResolvedValueOnce(mediaResponse)
    if (mediaResponse.status === 200 && mediaResponse.headers.get('content-type')?.includes('application/json')) {
      fetchMock.mockResolvedValueOnce(new Response('<svg />', { headers: { 'Content-Type': 'image/svg+xml' } }))
    }

    const response = await app.request(`/api/place-photos?name=${encodeURIComponent(name)}`, undefined, env)

    expect(response.status).toBe(502)
  })

  it('reports a missing key or photo without leaking provider details', async () => {
    const withoutKey = await app.request(`/api/place-photos?name=${encodeURIComponent(name)}`)
    expect(withoutKey.status).toBe(500)

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    const missing = await app.request(`/api/place-photos?name=${encodeURIComponent(name)}`, undefined, env)
    expect(missing.status).toBe(404)
    expect(JSON.stringify(await missing.json())).not.toContain(env.GOOGLE_PLACES_API_KEY)
  })
})
