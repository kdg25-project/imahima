import { describe, expect, it, vi, beforeEach } from 'vitest';
import app from '../index';

describe('GET /api/places/:placeId', () => {
  const env = { GOOGLE_MAPS_API_KEY: 'test-api-key' };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. 正常系
  it('正常な Place ID で POI 詳細情報を正しく返す', async () => {
    const mockGoogleResponse = {
      id: 'ChIJxxxxxxxx',
      displayName: { text: '○○カフェ', languageCode: 'ja' },
      formattedAddress: '愛知県名古屋市...',
      primaryType: 'cafe',
      rating: 4.2,
      currentOpeningHours: { openNow: true },
      location: { latitude: 35.17, longitude: 136.88 },
      photos: [{ name: 'places/ChIJ/photos/1', widthPx: 400, heightPx: 300 }],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockGoogleResponse), { status: 200 })
    );

    const response = await app.request('/api/places/ChIJxxxxxxxx', {}, env);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      id: 'ChIJxxxxxxxx',
      name: '○○カフェ',
      address: '愛知県名古屋市...',
      category: 'cafe',
      rating: 4.2,
      openNow: true,
      location: { lat: 35.17, lng: 136.88 },
      photos: [{ name: 'places/ChIJ/photos/1', widthPx: 400, heightPx: 300 }],
    });
  });

  // 2. 存在しない POI (404)
  it('存在しない placeId の場合は 404 を返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 404, message: 'Not found' } }), {
        status: 404,
      })
    );

    const response = await app.request('/api/places/non-existent-id', {}, env);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  // 3. 外部 API エラー (502)
  it('Google API がエラーを返した場合は 502 を返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Internal Error', { status: 500 })
    );

    const response = await app.request('/api/places/ChIJxxxxxxxx', {}, env);

    expect(response.status).toBe(502);
  });

  // 4. 一部データが欠損しているケースの正常系ハンドリング
  it('評価や営業情報がない場合も null として正常に返却する', async () => {
    const mockPartialResponse = {
      id: 'ChIJxxxxxxxx',
      displayName: { text: '最小限のスポット' },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockPartialResponse), { status: 200 })
    );

    const response = await app.request('/api/places/ChIJxxxxxxxx', {}, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 'ChIJxxxxxxxx',
      name: '最小限のスポット',
      address: null,
      category: null,
      rating: null,
      openNow: null,
      location: null,
      photos: [],
    });
  });
});