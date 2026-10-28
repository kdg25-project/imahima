import { describe, expect, it, vi, beforeEach } from 'vitest'
import app from '../index'

describe('POST /api/routes', () => {
  const env = { GOOGLE_MAPS_API_KEY: 'test-api-key' }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // 1. 正常系
  it('正常なリクエストで距離と所要時間（数値秒）を返す', async () => {
    const mockApiResponse = {
      routes: [
        {
          distanceMeters: 350,
          duration: '250s',
        },
      ],
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockApiResponse), { status: 200 })
    )

    const response = await app.request(
      '/api/routes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: 35.1709, lng: 136.8815 },
          destination: { lat: 35.1680, lng: 136.8850 },
          travelMode: 'WALK',
        }),
      },
      env
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({
      distanceMeters: 350,
      durationSeconds: 250,
    })
  })

  // 2. 入力不正（400）
  it('座標がない・不正な入力の場合は 400 を返す', async () => {
    const response = await app.request(
      '/api/routes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: 35.1709 }, // lng不足
          destination: { lat: 35.1680, lng: 136.8850 },
          travelMode: 'WALK',
        }),
      },
      env
    )

    expect(response.status).toBe(400)
    expect(response.headers.get('content-type')).toContain('application/json')
  })

  it('travelMode が WALK 以外の場合は 400 を返す', async () => {
    const response = await app.request(
      '/api/routes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: 35.1709, lng: 136.8815 },
          destination: { lat: 35.1680, lng: 136.8850 },
          travelMode: 'DRIVE',
        }),
      },
      env
    )

    expect(response.status).toBe(400)
  })

  // 3. 外部APIエラー（502）
  it('Google API がエラーを返した場合は 502 を返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('External Error', { status: 500 })
    )

    const response = await app.request(
      '/api/routes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: 35.1709, lng: 136.8815 },
          destination: { lat: 35.1680, lng: 136.8850 },
          travelMode: 'WALK',
        }),
      },
      env
    )

    expect(response.status).toBe(502)
  })

  // 4. 経路が見つからない場合
  it('経路が存在しない場合は 404 を返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ routes: [] }), { status: 200 })
    )

    const response = await app.request(
      '/api/routes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: 35.1709, lng: 136.8815 },
          destination: { lat: 35.1680, lng: 136.8850 },
          travelMode: 'WALK',
        }),
      },
      env
    )

    expect(response.status).toBe(404)
  })

  // 5. 既存の404チェック（残しておくテスト）
  it('GET は未登録のため 404 を返す', async () => {
    const response = await app.request('/api/routes')

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ error: 'Not Found' })
  })
})