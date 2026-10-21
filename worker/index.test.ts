import { describe, expect, it } from 'vitest'
import app from './index'

describe('API', () => {
  it('returns health as JSON', async () => {
    const response = await app.request('/api/health')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it.each(['/api', '/api/missing'])('returns JSON 404 for %s', async (path) => {
    const response = await app.request(path, { headers: { accept: 'text/html' } })
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ error: 'Not Found' })
  })
})
