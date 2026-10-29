import { Hono } from 'hono'

const locationRoutes = new Hono()

function parseCoordinate(value: string | undefined, min: number, max: number) {
    if (value === undefined || value.trim() === '') return undefined
    const coordinate = Number(value)
    return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max
        ? coordinate
        : undefined
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function uniqueAddressParts(parts: unknown[]) {
    return parts
        .filter((part): part is string => typeof part === 'string' && part.length > 0)
        .filter((part, index, values) => values.indexOf(part) === index)
}

function formatSearchAddress(address: unknown) {
    if (!isObject(address)) return undefined

    return uniqueAddressParts([
        address.state,
        address.prefecture,
        address.province,
        address.city,
        address.municipality,
        address.town,
        address.village,
        address.suburb,
        address.city_district,
        address.neighbourhood,
    ]).join(' ')
}

locationRoutes.get('/reverse', async (c) => {
    const lat = parseCoordinate(c.req.query('lat'), -90, 90)
    const lng = parseCoordinate(c.req.query('lng'), -180, 180)

    if (lat === undefined || lng === undefined) {
        return c.json({ error: 'Invalid lat or lng' }, 400)
    }

    const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client')
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lng))
    url.searchParams.set('localityLanguage', 'ja')

    try {
        const response = await fetch(url)
        if (!response.ok) return c.json({ error: 'Failed to reverse geocode' }, 502)

        const data: unknown = await response.json()
        if (!isObject(data)) return c.json({ error: 'Invalid location data' }, 502)

        const address = uniqueAddressParts([
            data.principalSubdivision,
            data.city,
            data.locality,
        ]).join(' ')

        if (!address) return c.json({ error: 'Location name unavailable' }, 502)
        return c.json({ name: address }, 200)
    } catch {
        return c.json({ error: 'Failed to reverse geocode' }, 502)
    }
})

locationRoutes.get('/search', async (c) => {
    const query = c.req.query('q')?.trim()
    if (!query) return c.json({ candidates: [] }, 200)
    if (query.length > 100) return c.json({ error: 'Query is too long' }, 400)

    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('limit', '5')
    url.searchParams.set('accept-language', 'ja')
    url.searchParams.set('countrycodes', 'jp')

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'imahima-location-search/1.0' },
        })
        if (!response.ok) return c.json({ error: 'Failed to search locations' }, 502)

        const data: unknown = await response.json()
        if (!Array.isArray(data)) return c.json({ error: 'Invalid location data' }, 502)

        const candidates = data.flatMap((item) => {
            if (!isObject(item)) return []
            const name = typeof item.name === 'string' && item.name.length > 0
                ? item.name
                : typeof item.display_name === 'string' ? item.display_name.split(',')[0] : undefined
            const area = formatSearchAddress(item.address) ?? (
                typeof item.display_name === 'string' ? item.display_name : undefined
            )
            const lat = typeof item.lat === 'string' ? Number(item.lat) : item.lat
            const lng = typeof item.lon === 'string' ? Number(item.lon) : item.lon
            if (
                name === undefined || area === undefined ||
                typeof lat !== 'number' || !Number.isFinite(lat) ||
                typeof lng !== 'number' || !Number.isFinite(lng)
            ) return []
            return [{ name, area, lat, lng }]
        })
        const uniqueCandidates = Array.from(candidates.reduce((unique, candidate) => {
            const normalizedName = candidate.name.normalize('NFKC').trim().toLocaleLowerCase('ja-JP')
            const key = `${normalizedName}|${candidate.lat.toFixed(4)}|${candidate.lng.toFixed(4)}`
            if (!unique.has(key)) unique.set(key, candidate)
            return unique
        }, new Map<string, (typeof candidates)[number]>()).values())

        return c.json({ candidates: uniqueCandidates }, 200)
    } catch {
        return c.json({ error: 'Failed to search locations' }, 502)
    }
})

export default locationRoutes