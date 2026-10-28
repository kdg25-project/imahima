import { describe, expect, it } from 'vitest'
import app from '../index'

describe('GET /api/search の一時ルーティング', () => {
  it('機能実装前は 501 の JSON を返す', async () => {
    const response = await app.request('/api/search')

    expect(response.status).toBe(501)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ error: 'Not Implemented' })
  })
})
