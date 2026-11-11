import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import app from '../index'

const env = { GOOGLE_MAPS_API_KEY: 'test-api-key' }
const validRequest = {
  origin: { lat: 35.1709, lng: 136.8815 },
  destination: { lat: 35.168, lng: 136.885 },
  travelMode: 'WALK',
}

function request(body: unknown = validRequest) {
  return app.request(
    '/api/routes',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    env,
  )
}

describe('POST /api/routes', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns distance and a fractional protobuf duration in seconds', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ routes: [{ distanceMeters: 350, duration: '250.5s' }] }),
    )

    const response = await request()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ distanceMeters: 350, durationSeconds: 250.5 })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
        }),
      }),
    )
  })

  it('preserves zero distance and duration values', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ routes: [{ distanceMeters: 0, duration: '0s' }] }),
    )

    const response = await request()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ distanceMeters: 0, durationSeconds: 0 })
  })

  it.each([null, [], 'not an object'])('returns 400 for a non-object JSON request body', async (body) => {
    const response = await request(body)

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON and invalid input fields', async () => {
    const malformed = await app.request(
      '/api/routes',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' },
      env,
    )
    const invalidCoordinate = await request({
      ...validRequest,
      origin: { lat: Number.NaN, lng: 136.8815 },
    })
    const invalidMode = await request({ ...validRequest, travelMode: 'DRIVE' })

    expect(malformed.status).toBe(400)
    expect(invalidCoordinate.status).toBe(400)
    expect(invalidMode.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 500 when the server key is absent', async () => {
    const response = await app.request(
      '/api/routes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest),
      },
      {},
    )

    expect(response.status).toBe(500)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['a rejected fetch', async () => { throw new TypeError('network failure') }],
    ['a non-success response', async () => new Response('External Error', { status: 500 })],
    ['an undecodable JSON response', async () => new Response('{', { status: 200 })],
  ])('returns 502 for %s', async (_caseName, responseFactory) => {
    fetchMock.mockImplementationOnce(responseFactory)

    const response = await request()

    expect(response.status).toBe(502)
  })

  it.each([
    [{ routes: null }],
    [{ routes: [null] }],
    [{ routes: [{ distanceMeters: '350', duration: '250s' }] }],
    [{ routes: [{ distanceMeters: 350, duration: 'invalid' }] }],
    [{ routes: [{ distanceMeters: -1, duration: '250s' }] }],
  ])('returns 502 for a malformed upstream route response', async (payload) => {
    fetchMock.mockResolvedValueOnce(Response.json(payload))

    const response = await request()

    expect(response.status).toBe(502)
  })

  it('returns 404 only when the upstream response has no routes', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ routes: [] }))

    const response = await request()

    expect(response.status).toBe(404)
  })

  it('does not expose the nested /api/routes/api/routes alias', async () => {
    const response = await app.request('/api/routes/api/routes', { method: 'POST' })

    expect(response.status).toBe(404)
  })

  it('keeps GET /api/routes unregistered', async () => {
    const response = await app.request('/api/routes')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not Found' })
  })
})
