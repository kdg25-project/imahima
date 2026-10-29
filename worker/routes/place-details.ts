import { Hono } from 'hono';

type Bindings = {
  GOOGLE_MAPS_API_KEY: string;
};

// Places API (New) のレスポンス型定義
type GooglePlaceDetailsResponse = {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  primaryType?: string;
  rating?: number;
  currentOpeningHours?: { openNow?: boolean };
  location?: { latitude?: number; longitude?: number };
  photos?: Array<{ name?: string; widthPx?: number; heightPx?: number }>;
  error?: { code?: number; message?: string; status?: string };
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/:placeId', async (c) => {
  const placeId = c.req.param('placeId');

  // 1. パラメータのバリデーション (空文字やテスト用の不正なIDを考慮)
  if (!placeId || placeId.trim() === '') {
    return c.json({ error: 'Invalid placeId' }, 400);
  }

  const apiKey = c.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_MAPS_API_KEY is not configured.');
    return c.json({ error: 'Internal server error' }, 500);
  }

  // 2. Google Places API (New) - Place Details の呼び出し
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // Place Details (New) では FieldMask に 'places.' プレフィックスを付けません
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,primaryType,rating,currentOpeningHours,location,photos',
      },
    });

    if (response.status === 404) {
      return c.json({ error: 'Place not found' }, 404);
    }

    if (response.status === 400) {
      return c.json({ error: 'Invalid placeId request' }, 400);
    }

    if (!response.ok) {
      console.error(`Google Places API error: status ${response.status}`);
      return c.json({ error: 'Failed to fetch place details' }, 502);
    }

    const data = (await response.json()) as GooglePlaceDetailsResponse;

    // 3. レスポンス整形
    const formattedResponse = {
      id: data.id ?? placeId,
      name: data.displayName?.text ?? null,
      address: data.formattedAddress ?? null,
      category: data.primaryType ?? null,
      rating: data.rating ?? null,
      openNow: data.currentOpeningHours?.openNow ?? null,
      location:
        data.location?.latitude !== undefined && data.location?.longitude !== undefined
          ? {
              lat: data.location.latitude,
              lng: data.location.longitude,
            }
          : null,
      photos:
        data.photos?.map((photo) => ({
          name: photo.name,
          widthPx: photo.widthPx,
          heightPx: photo.heightPx,
        })) ?? [],
    };

    return c.json(formattedResponse, 200);
  } catch (error) {
    console.error('Unexpected internal error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;