import { useEffect, useMemo, useRef, useState } from 'react'
import type { Coordinates } from '../../lib/api'
import './PlaceMap.css'

export type MapPlace = {
  id: string
  name: string
  location: Coordinates
}

type GoogleDataFeature = {
  getProperty(name: string): unknown
}

type GoogleListener = { remove(): void }

type GoogleDataLayer = {
  addGeoJson(value: unknown): GoogleDataFeature[]
  remove(feature: GoogleDataFeature): void
  setStyle(options: { clickable: boolean; title: string }): void
  addListener(event: 'click', callback: (event: { feature: GoogleDataFeature }) => void): GoogleListener
}

type GoogleBounds = {
  extend(position: Coordinates): void
}

type GoogleMapInstance = {
  data: GoogleDataLayer
  fitBounds(bounds: GoogleBounds, padding?: number): void
}

type MapsLibrary = {
  Map: new (element: HTMLElement, options: { center: Coordinates; zoom: number }) => GoogleMapInstance
}

type CoreLibrary = {
  LatLngBounds: new () => GoogleBounds
}

type GoogleMapsWindow = Window & {
  google?: { maps?: { importLibrary?: (name: 'maps' | 'core') => Promise<unknown> } }
  __imahimaGoogleMapsLoaded?: () => void
}

type PlaceMapProps = {
  origin?: Coordinates
  places?: MapPlace[]
  selectedPlaceId?: string
  onSelectPlace?: (placeId: string) => void
  className?: string
  place?: { name: string | null; location: Coordinates | null }
}

let mapsLibraryPromise: Promise<MapsLibrary & CoreLibrary> | undefined
const mapsCallbackName = '__imahimaGoogleMapsLoaded'

function mapsSearchUrl(location: Coordinates, name?: string) {
  const query = name ? `${name} ${location.lat},${location.lng}` : `${location.lat},${location.lng}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

function importMapsLibrary(apiKey: string): Promise<MapsLibrary & CoreLibrary> {
  if (mapsLibraryPromise) return mapsLibraryPromise

  mapsLibraryPromise = new Promise<MapsLibrary & CoreLibrary>((resolve, reject) => {
    const imported = () => {
      const mapsApi = (window as GoogleMapsWindow).google?.maps
      if (!mapsApi?.importLibrary) {
        reject(new Error('Google Maps did not load'))
        return
      }
      void Promise.all([mapsApi.importLibrary('maps'), mapsApi.importLibrary('core')]).then(([maps, core]) => {
        resolve({ ...(maps as MapsLibrary), ...(core as CoreLibrary) })
      }, reject)
    }

    if ((window as GoogleMapsWindow).google?.maps?.importLibrary) {
      imported()
      return
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-imahima-google-maps]')
    if (existing) {
      const previousCallback = (window as GoogleMapsWindow)[mapsCallbackName]
      ;(window as GoogleMapsWindow)[mapsCallbackName] = () => {
        previousCallback?.()
        imported()
      }
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.dataset.imahimaGoogleMaps = 'true'
    script.async = true
    ;(window as GoogleMapsWindow)[mapsCallbackName] = imported
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${mapsCallbackName}`
    script.addEventListener('error', () => reject(new Error('Google Maps failed to load')), { once: true })
    document.head.append(script)
  })

  return mapsLibraryPromise
}

export function PlaceMap({ origin, places, selectedPlaceId, onSelectPlace, className, place }: PlaceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onSelectPlaceRef = useRef(onSelectPlace)
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading')
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const mapPlaces = useMemo<MapPlace[]>(() => {
    if (places?.length) return places
    return place?.location && place.name ? [{ id: 'place', name: place.name, location: place.location }] : []
  }, [place, places])
  const selected = mapPlaces.find((item) => item.id === selectedPlaceId) ?? mapPlaces[0]
  const fallbackLocation = selected?.location ?? origin
  const classNames = ['place-map', className].filter(Boolean).join(' ')

  useEffect(() => {
    onSelectPlaceRef.current = onSelectPlace
  }, [onSelectPlace])

  useEffect(() => {
    let disposed = false
    let map: GoogleMapInstance | undefined
    let features: GoogleDataFeature[] = []
    let listener: GoogleListener | undefined

    if (!apiKey || !containerRef.current || !fallbackLocation) {
      setState('unavailable')
      return
    }

    setState('loading')
    void importMapsLibrary(apiKey).then((maps) => {
      if (disposed || !containerRef.current) return
      map = new maps.Map(containerRef.current, { center: fallbackLocation, zoom: 15 })
      const points = mapPlaces.length ? mapPlaces : [{ id: 'origin', name: '現在地', location: fallbackLocation }]
      if (points.length > 1) {
        const bounds = new maps.LatLngBounds()
        points.forEach((item) => bounds.extend(item.location))
        map.fitBounds(bounds, 32)
      }

      const data = map.data
      if (!data || typeof data.addGeoJson !== 'function' || typeof data.addListener !== 'function' || typeof data.setStyle !== 'function') {
        throw new Error('Google Maps data layer is unavailable')
      }
      data.setStyle({ clickable: true, title: '' })
      const addedFeatures = data.addGeoJson({
        type: 'FeatureCollection',
        features: mapPlaces.map((item) => ({
          type: 'Feature',
          id: item.id,
          properties: { placeId: item.id, title: item.name },
          geometry: { type: 'Point', coordinates: [item.location.lng, item.location.lat] },
        })),
      })
      if (!Array.isArray(addedFeatures)) {
        throw new Error('Google Maps did not add place features')
      }
      features = addedFeatures
      listener = data.addListener('click', (event) => {
        const placeId = event.feature.getProperty('placeId')
        if (typeof placeId === 'string') onSelectPlaceRef.current?.(placeId)
      })
      if (!disposed) setState('ready')
    }).catch(() => {
      if (!disposed) setState('error')
    })

    return () => {
      disposed = true
      listener?.remove()
      if (map && Array.isArray(features)) {
        const data = map.data
        if (data && typeof data.remove === 'function') features.forEach((feature) => data.remove(feature))
      }
      features = []
    }
  }, [apiKey, fallbackLocation, mapPlaces])

  return (
    <section className={classNames} aria-label="地図">
      {apiKey && fallbackLocation ? <div ref={containerRef} className="place-map__canvas" aria-label="Google マップ" /> : null}
      {state !== 'ready' ? (
        <div className="place-map__notice" role="status">
          {state === 'loading' ? '地図を読み込んでいます…' : state === 'error' ? '地図を表示できませんでした。' : 'この環境では地図を表示できません。'}
          {fallbackLocation ? <a href={mapsSearchUrl(fallbackLocation, selected?.name)} target="_blank" rel="noreferrer">Google マップで見る</a> : null}
        </div>
      ) : null}
      {mapPlaces.length > 0 ? (
        <ul className="place-map__places" aria-label="地図上の地点一覧">
          {mapPlaces.map((item) => (
            <li key={item.id}>
              <button type="button" aria-pressed={item.id === selectedPlaceId} onClick={() => onSelectPlace?.(item.id)}>{item.name}</button>
              <a href={mapsSearchUrl(item.location, item.name)} target="_blank" rel="noreferrer">地図で開く</a>
            </li>
          ))}
        </ul>
      ) : null}
      {state === 'ready' && origin ? <p className="place-map__origin">現在地を中心に表示しています。</p> : null}
      {state === 'ready' ? <p className="place-map__attribution">地図データ © Google</p> : null}
    </section>
  )
}
