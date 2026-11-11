import { afterEach, describe, expect, it, vi } from 'vitest'
import app from '../index'

describe('GET /api/search の入力チェック', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    '/api/search?lng=136&mode=nearby',
    '/api/search?lat=35&mode=nearby',
    '/api/search?lat=%20&lng=136&mode=nearby',
    '/api/search?lat=abc&lng=136&mode=nearby',
    '/api/search?lat=91&lng=136&mode=nearby',
    '/api/search?lat=35&lng=-181&mode=nearby',
    '/api/search?lat=35&lng=136',
    '/api/search?lat=35&lng=136&mode=unknown',
    '/api/search?lat=35&lng=136&mode=nearby&category=unknown',
    '/api/search?lat=35&lng=136&mode=nearby&radius=abc',
    '/api/search?lat=35&lng=136&mode=nearby&radius=0',
    '/api/search?lat=35&lng=136&mode=nearby&radius=50001',
    '/api/search?lat=35&lng=136&mode=free-time&duration=abc',
    '/api/search?lat=35&lng=136&mode=free-time&duration=0',
  ])('不正な入力で400を返す %s', async (path) => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(
      new Error('Unexpected fetch during validation'),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await app.request(path)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: expect.any(String) })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})