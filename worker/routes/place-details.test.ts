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
      currentOpeningHours: { openNow: true, weekdayDescriptions: ['臨時営業時間'] },
      regularOpeningHours: { weekdayDescriptions: ['月曜日: 9:00～18:00', '火曜日: 9:00～18:00'] },
      priceRange: {
        startPrice: { currencyCode: 'JPY', units: '300' },
        endPrice: { currencyCode: 'JPY', units: '1000' },
      },
      priceLevel: 'PRICE_LEVEL_MODERATE',
      location: { latitude: 35.17, longitude: 136.88 },
      photos: [{
        name: 'places/ChIJ/photos/1',
        widthPx: 400,
        heightPx: 300,
        authorAttributions: [{ displayName: '撮影者', uri: 'https://example.com/author' }],
      }],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockGoogleResponse), { status: 200 })
    );

    const response = await app.request('/api/places/ChIJxxxxxxxx', {}, env);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0])).toBe('https://places.googleapis.com/v1/places/ChIJxxxxxxxx?languageCode=ja');
    expect(await response.json()).toEqual({
      id: 'ChIJxxxxxxxx',
      name: '○○カフェ',
      address: '愛知県名古屋市...',
      category: 'cafe',
      appCategory: 'cafe',
      rating: 4.2,
      openNow: true,
      openingHours: ['月曜日: 9:00～18:00', '火曜日: 9:00～18:00'],
      budget: '￥300〜￥1,000',
      location: { lat: 35.17, lng: 136.88 },
      photos: [{
        name: 'places/ChIJ/photos/1',
        widthPx: 400,
        heightPx: 300,
        authorAttributions: [{ displayName: '撮影者', uri: 'https://example.com/author' }],
      }],
    });
    expect(new Headers(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.headers).get('X-Goog-FieldMask')).toContain('regularOpeningHours')
    expect(new Headers(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.headers).get('X-Goog-FieldMask')).toContain('priceRange')
  });

  it('営業時間は通常時間を優先し、予算の不正な範囲は価格レベルへフォールバックする', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({
      id: 'fallback-place',
      currentOpeningHours: { openNow: false, weekdayDescriptions: ['本日: 休業'] },
      regularOpeningHours: { weekdayDescriptions: ['月曜日: 10:00～18:00', 42] },
      priceRange: {
        startPrice: { currencyCode: 'JPY', units: '1000' },
        endPrice: { currencyCode: 'JPY', units: 'not-a-number' },
      },
      priceLevel: 'PRICE_LEVEL_INEXPENSIVE',
    }))

    const response = await app.request('/api/places/fallback-place', {}, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      openNow: false,
      openingHours: ['月曜日: 10:00～18:00'],
      budget: '安め',
    })
  })

  it('上限のない価格帯は「以上」として返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({
      id: 'open-ended-price',
      priceRange: { startPrice: { currencyCode: 'JPY', units: '1000' } },
    }))

    const response = await app.request('/api/places/open-ended-price', {}, env)

    expect(await response.json()).toMatchObject({ budget: '￥1,000以上' })
  })

  it('新しいPlacesキーを優先し、従来のMapsキーにも後方互換で対応する', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'place-id' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'place-id' }), { status: 200 }))

    const withBothKeys = await app.request('/api/places/place-id', {}, {
      GOOGLE_PLACES_API_KEY: 'new-places-key',
      GOOGLE_MAPS_API_KEY: 'legacy-maps-key',
    })
    expect(withBothKeys.status).toBe(200)
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('X-Goog-Api-Key')).toBe('new-places-key')

    const withLegacyKey = await app.request('/api/places/place-id', {}, {
      GOOGLE_MAPS_API_KEY: 'legacy-maps-key',
    })
    expect(withLegacyKey.status).toBe(200)
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('X-Goog-Api-Key')).toBe('legacy-maps-key')
  });

  it('生の主分類を残しつつ、公園タグ付き観光地の認識済みカテゴリを追加する', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({
        id: 'park-place',
        primaryType: 'tourist_attraction',
        types: ['tourist_attraction', 'city_park', 'park'],
      }),
    )

    const response = await app.request('/api/places/park-place', {}, env)

    expect(response.status).toBe(200)
    expect(new Headers(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.headers).get('X-Goog-FieldMask')).toContain('types')
    expect(await response.json()).toMatchObject({
      category: 'tourist_attraction',
      appCategory: 'park',
    })
  })

  it.each([
    ['sports_complex', ['sports_complex', 'karaoke'], 'entertainment'],
    ['cafe', ['cafe', 'internet_cafe'], 'entertainment'],
  ])('詳細でも関連タグを同じアプリカテゴリへ正規化する', async (primaryType, types, appCategory) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({ id: 'mixed-place', primaryType, types }),
    )

    const response = await app.request('/api/places/mixed-place', {}, env)

    expect(await response.json()).toMatchObject({ category: primaryType, appCategory })
  })

  it('Placesキーが未設定なら外部リクエストをせず設定エラーを返す', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const response = await app.request('/api/places/place-id')

    expect(response.status).toBe(500)
    expect(fetchMock).not.toHaveBeenCalled()
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

  it('Google API への通信が失敗した場合は 502 を返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('network down'));

    const response = await app.request('/api/places/ChIJxxxxxxxx', {}, env);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Failed to fetch place details' });
  });

  it('Google API のJSONをデコードできない場合は 502 を返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{', { status: 200 }));

    const response = await app.request('/api/places/ChIJxxxxxxxx', {}, env);

    expect(response.status).toBe(502);
  });

  it.each([
    null,
    { displayName: 'invalid' },
    { location: { latitude: '35.17', longitude: 136.88 } },
    { types: ['cafe', 42] },
    { photos: [null] },
    { photos: [{ authorAttributions: [null] }] },
  ])('Google API の壊れた応答 %j は 502 を返す', async (body) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status: 200 })
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
      appCategory: null,
      rating: null,
      openNow: null,
      openingHours: [],
      budget: null,
      location: null,
      photos: [],
    });
  });
});
