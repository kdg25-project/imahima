import { Hono } from 'hono';

type Bindings = {
  GOOGLE_MAPS_API_KEY: string;
};

type Location = {
  lat: number;
  lng: number;
};

type RoutesRequestBody = {
  origin?: Location;
  destination?: Location;
  travelMode?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// 緯度経度のバリデーション
function isValidLocation(loc: unknown): loc is Location {
  return (
    typeof loc === 'object' &&
    loc !== null &&
    'lat' in loc &&
    'lng' in loc &&
    typeof (loc as Record<string, unknown>).lat === 'number' &&
    !isNaN((loc as Record<string, unknown>).lat as number) &&
    ((loc as Record<string, unknown>).lat as number) >= -90 &&
    ((loc as Record<string, unknown>).lat as number) <= 90 &&
    typeof (loc as Record<string, unknown>).lng === 'number' &&
    !isNaN((loc as Record<string, unknown>).lng as number) &&
    ((loc as Record<string, unknown>).lng as number) >= -180 &&
    ((loc as Record<string, unknown>).lng as number) <= 180
  );
}

app.post('/api/routes', async (c) => {
  let body: RoutesRequestBody;
  
  // 1. JSON Body の読み取りとバリデーション
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  const { origin, destination, travelMode } = body;

  if (!isValidLocation(origin) || !isValidLocation(destination)) {
    return c.json({ error: 'Invalid origin or destination coordinates' }, 400);
  }

  if (travelMode !== 'WALK') {
    return c.json({ error: 'Unsupported travelMode. Only WALK is allowed' }, 400);
  }

  // APIキーの確認
  const apiKey = c.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_MAPS_API_KEY is not configured.');
    return c.json({ error: 'Internal server error' }, 500);
  }

  // 2. Google Routes API (Compute Routes) の呼び出し
  const googleRoutesUrl = 'https://routes.googleapis.com/directions/v2:computeRoutes';

  const requestPayload = {
    origin: {
      location: {
        latLng: {
          latitude: origin.lat,
          longitude: origin.lng,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destination.lat,
          longitude: destination.lng,
        },
      },
    },
    travelMode: 'WALK',
  };

  try {
    const response = await fetch(googleRoutesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // 必要最小限のフィールドマスクを設定
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      console.error(`Google Routes API error: status ${response.status}`);
      return c.json({ error: 'Failed to fetch route from external API' }, 502);
    }

    const data = (await response.json()) as {
      routes?: Array<{
        distanceMeters?: number;
        duration?: string; // "123s" のような文字列
      }>;
    };

    // 経路が見つからない・返却データがない場合
    if (!data.routes || data.routes.length === 0) {
      return c.json({ error: 'No route found' }, 404);
    }

    const route = data.routes[0];
    const distanceMeters = route.distanceMeters ?? 0;

    // 3. duration (例: "300s") を数値 (秒) に変換
    let durationSeconds = 0;
    if (route.duration) {
      durationSeconds = parseInt(route.duration.replace('s', ''), 10);
      if (isNaN(durationSeconds)) {
        durationSeconds = 0;
      }
    }

    return c.json({
      distanceMeters,
      durationSeconds,
    });
  } catch (error) {
    console.error('Unexpected internal error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;