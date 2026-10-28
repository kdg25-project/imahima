import { describe, expect, it } from 'vitest'
import app from '../index'

describe('POST /api/routes の一時ルーティング', () => {
  it('機能実装前は 501 の JSON を返す', async () => {
    const response = await app.request('/api/routes', { method: 'POST' })

    expect(response.status).toBe(501)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ error: 'Not Implemented' })
  })

  it('GET は未登録のため 404 を返す', async () => {
    const response = await app.request('/api/routes')

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ error: 'Not Found' })
  })
})
