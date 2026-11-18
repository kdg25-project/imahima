import { Hono } from 'hono';
import { normalizePoiCategory } from '../../shared/poi-taxonomy'

type Bindings = {
  GOOGLE_PLACES_API_KEY?: string;
  GOOGLE_MAPS_API_KEY?: string;
};

// Places API (New) のレスポンス型定義
type GooglePlaceDetailsResponse = {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  primaryType?: string;
  types?: string[];
  rating?: number;
  currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: unknown };
  regularOpeningHours?: { weekdayDescriptions?: unknown };
  priceLevel?: unknown;
  priceRange?: unknown;
  location?: { latitude?: number; longitude?: number };
  photos?: Array<{
    name?: string;
    widthPx?: number;
    heightPx?: number;
    authorAttributions?: Array<{
      displayName?: string;
      uri?: string;
      photoUri?: string;
    }>;
  }>;
  error?: { code?: number; message?: string; status?: string };
};

class InvalidGooglePlacesResponseError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertOptionalString(value: unknown) {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new InvalidGooglePlacesResponseError()
  }
}

function assertOptionalFiniteNumber(value: unknown) {
  if (
    value !== undefined &&
    value !== null &&
    (typeof value !== 'number' || !Number.isFinite(value))
  ) {
    throw new InvalidGooglePlacesResponseError()
  }
}

function assertOptionalBoolean(value: unknown) {
  if (value !== undefined && value !== null && typeof value !== 'boolean') {
    throw new InvalidGooglePlacesResponseError()
  }
}

type PriceAmount = {
  currencyCode: string
  units: string
  nanos: number
}

function normalizeOpeningHours(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.weekdayDescriptions)) return []
  return value.weekdayDescriptions.filter(
    (description): description is string => typeof description === 'string' && description.trim() !== '',
  )
}

function normalizePriceAmount(value: unknown): PriceAmount | null {
  if (!isRecord(value)) return null
  if (typeof value.currencyCode !== 'string' || !/^[A-Z]{3}$/.test(value.currencyCode)) return null
  if (value.units !== undefined && (typeof value.units !== 'string' || !/^-?\d+$/.test(value.units))) return null
  if (
    value.nanos !== undefined &&
    (typeof value.nanos !== 'number' || !Number.isInteger(value.nanos) || Math.abs(value.nanos) > 999_999_999)
  ) {
    return null
  }
  return {
    currencyCode: value.currencyCode,
    units: value.units ?? '0',
    nanos: value.nanos ?? 0,
  }
}

function normalizePriceRange(value: unknown) {
  if (!isRecord(value)) return null
  const startPrice = normalizePriceAmount(value.startPrice)
  if (!startPrice) return null
  const endPrice = normalizePriceAmount(value.endPrice)
  return { startPrice, ...(endPrice ? { endPrice } : {}) }
}

const priceLevelLabels: Record<string, string> = {
  PRICE_LEVEL_FREE: '無料',
  PRICE_LEVEL_INEXPENSIVE: '安め',
  PRICE_LEVEL_MODERATE: '標準',
  PRICE_LEVEL_EXPENSIVE: '高め',
  PRICE_LEVEL_VERY_EXPENSIVE: '高級',
}

function priceLevelLabel(value: unknown) {
  return typeof value === 'string' && Object.hasOwn(priceLevelLabels, value)
    ? priceLevelLabels[value]
    : null
}

function priceAmountValue(amount: PriceAmount) {
  const units = Number(amount.units)
  if (!Number.isSafeInteger(units) || units < 0 || amount.nanos < 0) return null
  return units + amount.nanos / 1_000_000_000
}

function formatPriceAmount(amount: PriceAmount) {
  const value = priceAmountValue(amount)
  if (value === null) return null
  try {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: amount.currencyCode,
      currencyDisplay: 'narrowSymbol',
    }).format(value)
  } catch {
    return null
  }
}

function formatBudget(priceRange: unknown, priceLevel: unknown) {
  const range = normalizePriceRange(priceRange)
  const hasEndPrice = isRecord(priceRange) && Object.hasOwn(priceRange, 'endPrice')
  const startValue = range ? priceAmountValue(range.startPrice) : null
  const startPrice = range ? formatPriceAmount(range.startPrice) : null
  if (range && startValue !== null && startPrice) {
    if (!hasEndPrice) return `${startPrice}以上`
    if (!range.endPrice) return priceLevelLabel(priceLevel)
    const endValue = priceAmountValue(range.endPrice)
    const endPrice = formatPriceAmount(range.endPrice)
    if (endValue !== null && endPrice && range.startPrice.currencyCode === range.endPrice.currencyCode && endValue > startValue) {
      return `${startPrice}〜${endPrice}`
    }
  }
  return priceLevelLabel(priceLevel)
}

function validateGooglePlaceDetailsResponse(
  value: unknown,
): asserts value is GooglePlaceDetailsResponse {
  if (!isRecord(value)) throw new InvalidGooglePlacesResponseError()

  assertOptionalString(value.id)
  assertOptionalString(value.formattedAddress)
  assertOptionalString(value.primaryType)
  if (value.types !== undefined && value.types !== null) {
    if (!Array.isArray(value.types) || value.types.some((type) => typeof type !== 'string')) {
      throw new InvalidGooglePlacesResponseError()
    }
  }
  assertOptionalFiniteNumber(value.rating)

  if (value.displayName !== undefined && value.displayName !== null) {
    if (!isRecord(value.displayName)) throw new InvalidGooglePlacesResponseError()
    assertOptionalString(value.displayName.text)
  }

  if (value.currentOpeningHours !== undefined && value.currentOpeningHours !== null) {
    if (!isRecord(value.currentOpeningHours)) {
      throw new InvalidGooglePlacesResponseError()
    }
    assertOptionalBoolean(value.currentOpeningHours.openNow)
  }

  if (value.location !== undefined && value.location !== null) {
    if (!isRecord(value.location)) throw new InvalidGooglePlacesResponseError()
    assertOptionalFiniteNumber(value.location.latitude)
    assertOptionalFiniteNumber(value.location.longitude)
  }

  if (value.photos !== undefined && value.photos !== null) {
    if (!Array.isArray(value.photos)) throw new InvalidGooglePlacesResponseError()
    for (const photo of value.photos) {
      if (!isRecord(photo)) throw new InvalidGooglePlacesResponseError()
      assertOptionalString(photo.name)
      assertOptionalFiniteNumber(photo.widthPx)
      assertOptionalFiniteNumber(photo.heightPx)
      if (photo.authorAttributions !== undefined && photo.authorAttributions !== null) {
        if (!Array.isArray(photo.authorAttributions)) {
          throw new InvalidGooglePlacesResponseError()
        }
        for (const attribution of photo.authorAttributions) {
          if (!isRecord(attribution)) throw new InvalidGooglePlacesResponseError()
          assertOptionalString(attribution.displayName)
          assertOptionalString(attribution.uri)
          assertOptionalString(attribution.photoUri)
        }
      }
    }
  }
}

const app = new Hono<{ Bindings: Bindings }>();

app.get('/:placeId', async (c) => {
  const placeId = c.req.param('placeId');

  // 1. パラメータのバリデーション (空文字やテスト用の不正なIDを考慮)
  if (!placeId || placeId.trim() === '') {
    return c.json({ error: 'Invalid placeId' }, 400);
  }

  const apiKey = c.env.GOOGLE_PLACES_API_KEY ?? c.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_MAPS_API_KEY is not configured.');
    return c.json({ error: 'Internal server error' }, 500);
  }

  // 2. Google Places API (New) - Place Details の呼び出し
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set('languageCode', 'ja');

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // Place Details (New) では FieldMask に 'places.' プレフィックスを付けません
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,primaryType,types,rating,currentOpeningHours,regularOpeningHours,priceRange,priceLevel,location,photos,photos.authorAttributions',
      },
    });
  } catch (error) {
    console.error('Google Places API request failed:', error);
    return c.json({ error: 'Failed to fetch place details' }, 502);
  }

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

  let data: GooglePlaceDetailsResponse
  try {
    const decoded: unknown = await response.json()
    validateGooglePlaceDetailsResponse(decoded)
    data = decoded
  } catch (error) {
    console.error('Invalid Google Places API response:', error)
    return c.json({ error: 'Failed to fetch place details' }, 502)
  }

  // 3. レスポンス整形
  const formattedResponse = {
    id: data.id ?? placeId,
    name: data.displayName?.text ?? null,
    address: data.formattedAddress ?? null,
    category: data.primaryType ?? null,
    appCategory: normalizePoiCategory(data.primaryType, data.types ?? []) ?? null,
    rating: data.rating ?? null,
    openNow: data.currentOpeningHours?.openNow ?? null,
    openingHours: (() => {
      const regularHours = normalizeOpeningHours(data.regularOpeningHours)
      return regularHours.length > 0 ? regularHours : normalizeOpeningHours(data.currentOpeningHours)
    })(),
    budget: formatBudget(data.priceRange, data.priceLevel),
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
        authorAttributions: photo.authorAttributions ?? [],
      })) ?? [],
  };

  return c.json(formattedResponse, 200);
});

export default app;
