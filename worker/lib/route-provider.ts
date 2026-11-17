import { withUpstreamTimeout } from './upstream'

export type Coordinates = {
  lat: number
  lng: number
}

export type RouteLookup =
  | { kind: 'ok'; distanceMeters: number; durationSeconds: number }
  | { kind: 'not-found' }
  | { kind: 'configuration' }
  | { kind: 'failure' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseDurationSeconds(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,9})?s$/.test(value)) {
    return undefined
  }

  const durationSeconds = Number(value.slice(0, -1))
  return Number.isFinite(durationSeconds) && durationSeconds >= 0
    ? durationSeconds
    : undefined
}

export async function getWalkingRoute({
  origin,
  destination,
  apiKey,
  signal,
}: {
  origin: Coordinates
  destination: Coordinates
  apiKey?: string
  signal?: AbortSignal
}): Promise<RouteLookup> {
  if (!apiKey) return { kind: 'configuration' }

  try {
    return await withUpstreamTimeout(
      async (upstreamSignal) => {
        const response = await fetch(
          'https://routes.googleapis.com/directions/v2:computeRoutes',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
            },
            body: JSON.stringify({
              origin: {
                location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
              },
              destination: {
                location: {
                  latLng: { latitude: destination.lat, longitude: destination.lng },
                },
              },
              travelMode: 'WALK',
            }),
            signal: upstreamSignal,
          },
        )
        if (!response.ok) return { kind: 'failure' } as const

        const data: unknown = await response.json()
        if (!isRecord(data)) {
          return { kind: 'failure' } as const
        }
        if (data.routes === undefined) return { kind: 'not-found' } as const
        if (!Array.isArray(data.routes)) return { kind: 'failure' } as const
        if (data.routes.length === 0) return { kind: 'not-found' } as const

        const route = data.routes[0]
        if (!isRecord(route)) return { kind: 'failure' } as const

        const distanceMeters =
          route.distanceMeters === undefined ? 0 : route.distanceMeters
        if (
          typeof distanceMeters !== 'number' ||
          !Number.isSafeInteger(distanceMeters) ||
          distanceMeters < 0
        ) {
          return { kind: 'failure' } as const
        }

        const durationSeconds = parseDurationSeconds(route.duration)
        return durationSeconds === undefined
          ? ({ kind: 'failure' } as const)
          : { kind: 'ok', distanceMeters, durationSeconds }
      },
      { signal },
    )
  } catch {
    return { kind: 'failure' }
  }
}
