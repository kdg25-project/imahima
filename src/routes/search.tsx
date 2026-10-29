import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'

type LocationCandidate = {
  name: string
  area: string
  lat: number
  lng: number
}

type LocationStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'unsupported' | 'error'
type LocationNameStatus = 'idle' | 'loading' | 'ready' | 'error'

function parseCoordinate(value: unknown): number | undefined {
  const coordinate = Number(value)
  return Number.isFinite(coordinate) ? coordinate : undefined
}

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>) => ({
    lat: parseCoordinate(search.lat),
    lng: parseCoordinate(search.lng),
    name: typeof search.name === 'string' ? search.name : undefined,
    area: typeof search.area === 'string' ? search.area : undefined,
  }),
  component: Search,
})

function Search() {
  const navigate = useNavigate({ from: '/search' })
  const { lat, lng, name, area } = Route.useSearch()
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [locationNameStatus, setLocationNameStatus] = useState<LocationNameStatus>('idle')
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<LocationCandidate[]>([])
  const [candidateStatus, setCandidateStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [isLocationOpen, setIsLocationOpen] = useState(false)
  const hasRequestedLocation = useRef(false)

  useEffect(() => {
    if (query.trim().length < 2) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setCandidateStatus('loading')
      fetch(`/api/location/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('Location search failed')
          const data: unknown = await response.json()
          if (typeof data !== 'object' || data === null || !('candidates' in data) || !Array.isArray(data.candidates)) {
            throw new Error('Invalid location search response')
          }
          setCandidates(data.candidates as LocationCandidate[])
          setCandidateStatus('idle')
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setCandidates([])
            setCandidateStatus('error')
          }
        })
    }, 150)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const requestCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported')
      return
    }

    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocationStatus('granted')
        setLocationNameStatus('loading')
        let locationName = '現在地'
        try {
          const response = await fetch(
            `/api/location/reverse?lat=${position.coords.latitude}&lng=${position.coords.longitude}`,
          )
          if (response.ok) {
            const data: unknown = await response.json()
            if (typeof data === 'object' && data !== null && 'name' in data && typeof data.name === 'string') {
              locationName = data.name
              setLocationNameStatus('ready')
            }
          }
          if (locationName === '現在地') setLocationNameStatus('error')
        } catch {
          setLocationNameStatus('error')
        }
        void navigate({
          search: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            name: '現在地',
            area: locationName,
          },
          replace: true,
        })
        setIsLocationOpen(false)
      },
      (error) => {
        setLocationNameStatus('idle')
        setLocationStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }, [navigate])

  useEffect(() => {
    if (hasRequestedLocation.current) return
    hasRequestedLocation.current = true
    requestCurrentLocation()
  }, [requestCurrentLocation])

  const selectCandidate = (candidate: LocationCandidate) => {
    void navigate({
      search: { lat: candidate.lat, lng: candidate.lng, name: candidate.name, area: candidate.area },
      replace: true,
    })
    setQuery('')
  }

  const selectedLocation = lat !== undefined && lng !== undefined && name
    ? { name, area, lat, lng }
    : { name: '現在地周辺', area: undefined, lat: undefined, lng: undefined }

  const selectedLocationLabel = selectedLocation.name === '現在地' ? '現在地周辺' : selectedLocation.name

  return (
    <div className="location-page">
      <section className="intro">
        <p className="eyebrow">エリア</p>
        <h1>近くから探す</h1>
        <p>現在地や駅名・地名から選べます。</p>
      </section>

      <section className={`location-selector${isLocationOpen ? ' is-open' : ''}`} aria-labelledby="location-selector-heading">
        <button
          className="location-selector-toggle"
          aria-expanded={isLocationOpen}
          aria-controls="location-options"
          onClick={() => setIsLocationOpen((open) => !open)}
        >
          <span className="location-selector-icon" aria-hidden="true">⌖</span>
          <span className="location-selector-copy">
            <span className="section-label">エリア</span>
            <strong id="location-selector-heading">{selectedLocationLabel}</strong>
            {selectedLocation.area && <small>{selectedLocation.area}</small>}
            {!selectedLocation.area && locationStatus === 'loading' && <small>現在地を確認中…</small>}
          </span>
          <span className="location-selector-chevron" aria-hidden="true">⌄</span>
        </button>

        {isLocationOpen && (
          <div id="location-options" className="location-options">
            <div className="location-option-group">
              <p className="option-heading">現在地を使う</p>
              <button className="primary-button" onClick={requestCurrentLocation} disabled={locationStatus === 'loading'}>
                {locationStatus === 'loading' ? '現在地を確認中…' : '現在地を取得'}
              </button>
              <p className="status-message" aria-live="polite">
                {locationStatus === 'denied' && '位置情報が許可されていません。'}
                {locationStatus === 'unsupported' && 'このブラウザは位置情報に対応していません。'}
                {locationStatus === 'error' && '現在地を取得できませんでした。'}
                {locationStatus === 'granted' && '現在地を検索条件に設定しました。'}
              </p>
              {(locationStatus === 'denied' || locationStatus === 'error') && (
                <button className="text-button" onClick={requestCurrentLocation}>再試行</button>
              )}
            </div>

            <div className="location-option-group">
              <p className="option-heading">駅名・地名で変更</p>
              <label className="search-field">
                <span>駅名または地名</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="例：新宿、横浜駅"
                  aria-describedby="location-search-note"
                />
              </label>
              <p id="location-search-note" className="muted">候補から選んだ地点が検索条件になります。</p>
              {query.trim().length >= 2 && (
                <div className="candidate-list" aria-live="polite">
                  {candidateStatus === 'loading' && <p className="muted">候補を検索中…</p>}
                  {candidateStatus === 'error' && <p className="empty-message">候補を取得できませんでした。</p>}
                  {candidateStatus === 'idle' && candidates.length > 0 && candidates.map((candidate) => (
                    <button className="candidate" key={`${candidate.name}|${candidate.area}`} onClick={() => { selectCandidate(candidate); setIsLocationOpen(false) }}>
                      <strong>{candidate.name}</strong>
                      <span>{candidate.area}</span>
                    </button>
                  ))}
                  {candidateStatus === 'idle' && candidates.length === 0 && (
                    <p className="empty-message">候補が見つかりません。</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {name === '現在地' && locationNameStatus === 'error' && (
        <p className="status-message" aria-live="polite">住所名を取得できませんでした。</p>
      )}

      <Link className="back-link" to="/">ホームへ戻る</Link>
    </div>
  )
}
