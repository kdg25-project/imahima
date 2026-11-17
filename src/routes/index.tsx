import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  Coffee,
  Dumbbell,
  LayoutGrid,
  MapPinPlus,
  MapPinned,
  MoreHorizontal,
  PartyPopper,
  Search,
  ShoppingCart,
  TreeDeciduous,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { buttonClassName, ButtonArrow } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { ChoiceChip } from '../components/ui/Chip'
import { TimeRange } from '../components/ui/TimeRange'
import { LoadingState } from '../components/feedback/States'
import { parseHomeSearchParams } from '../lib/search-params'

const UiPreview = import.meta.env.DEV ? lazy(() => import('../components/dev/UiPreview').then(module => ({ default: module.UiPreview }))) : null

export const Route = createFileRoute('/')({ validateSearch: parseHomeSearchParams, component: Home })
const categories: { label: string; icon: LucideIcon }[] = [
  { label: 'すべて', icon: LayoutGrid },
  { label: 'カフェ', icon: Coffee },
  { label: 'ごはん', icon: Utensils },
  { label: '買い物', icon: ShoppingCart },
  { label: '遊び', icon: PartyPopper },
  { label: '観光', icon: MapPinned },
  { label: '運動', icon: Dumbbell },
  { label: '自然', icon: TreeDeciduous },
  { label: 'その他', icon: MoreHorizontal },
]
const timeLabels = ['~15分', '30分', '1時間', '2時間', '3時間~']
const timeMinutes = [15, 30, 60, 120, 180] as const
const walkMinutes = 15

function timePositionFor(freeTime: number | undefined) {
  const index = freeTime === undefined ? -1 : timeMinutes.indexOf(freeTime as typeof timeMinutes[number])
  return index >= 0 ? index : 2
}

type LocationCandidate = { name: string; area: string; lat: number; lng: number }
type LocationStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'unsupported' | 'error'

function locationStatusMessage(status: LocationStatus) {
  if (status === 'loading') return '現在地を確認しています…'
  if (status === 'denied') return '現在地を取得できませんでした。駅名・地名から選べます。'
  if (status === 'unsupported') return 'このブラウザでは現在地を取得できません。駅名・地名から選べます。'
  if (status === 'error') return '現在地を取得できませんでした。駅名・地名から選べます。'
  return undefined
}

function Home() {
  const navigate = useNavigate({ from: '/' })
  const initialSearch = Route.useSearch()
  const [mode, setMode] = useState<'nearby' | 'free-time'>(initialSearch.mode ?? 'nearby')
  const [category, setCategory] = useState(initialSearch.category ?? 'すべて')
  const [timePosition, setTimePosition] = useState(() => timePositionFor(initialSearch.freeTime))
  const [locationName, setLocationName] = useState(initialSearch.area ?? '現在地周辺')
  const [selectedLocationName, setSelectedLocationName] = useState(initialSearch.name ?? initialSearch.area ?? '現在地')
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | undefined>(() => initialSearch.lat !== undefined && initialSearch.lng !== undefined ? { lat: initialSearch.lat, lng: initialSearch.lng } : undefined)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [locationQuery, setLocationQuery] = useState('')
  const [candidates, setCandidates] = useState<LocationCandidate[]>([])
  const [candidateStatus, setCandidateStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [isLocationOpen, setIsLocationOpen] = useState(false)
  const [searchNotice, setSearchNotice] = useState<string>()
  const { preview } = initialSearch
  const locationGenerationRef = useRef(0)
  const reverseControllerRef = useRef<AbortController | undefined>(undefined)
  const isMountedRef = useRef(false)
  const autoLocationRequestedRef = useRef(false)
  const hasInitialCoordinatesRef = useRef(coordinates !== undefined)

  const invalidateLocationIntent = useCallback(() => {
    locationGenerationRef.current += 1
    reverseControllerRef.current?.abort()
    reverseControllerRef.current = undefined
    return locationGenerationRef.current
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      reverseControllerRef.current?.abort()
      reverseControllerRef.current = undefined
    }
  }, [])

  useEffect(() => {
    if (locationQuery.trim().length < 2) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setCandidateStatus('loading')
      fetch(`/api/location/search?q=${encodeURIComponent(locationQuery.trim())}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('Location search failed')
          const data: unknown = await response.json()
          if (typeof data !== 'object' || data === null || !('candidates' in data) || !Array.isArray(data.candidates)) throw new Error('Invalid location response')
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
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [locationQuery])

  const requestCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported')
      setIsLocationOpen(true)
      return
    }
    const generation = invalidateLocationIntent()
    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(async (position) => {
      if (!isMountedRef.current || generation !== locationGenerationRef.current) return
      const nextCoordinates = { lat: position.coords.latitude, lng: position.coords.longitude }
      setCoordinates(nextCoordinates)
      setLocationStatus('granted')
      setLocationName('現在地周辺')
      setSelectedLocationName('現在地')
      setSearchNotice(undefined)
      const controller = new AbortController()
      reverseControllerRef.current = controller
      try {
        const response = await fetch(`/api/location/reverse?lat=${nextCoordinates.lat}&lng=${nextCoordinates.lng}`, { signal: controller.signal })
        const data: unknown = await response.json()
        if (isMountedRef.current && generation === locationGenerationRef.current && !controller.signal.aborted && response.ok && typeof data === 'object' && data !== null && 'name' in data && typeof data.name === 'string') setLocationName(data.name)
      } catch {
        // Keep the usable fallback label when reverse geocoding fails.
      }
    }, (error) => {
      if (!isMountedRef.current || generation !== locationGenerationRef.current) return
      setLocationStatus(error.code === 1 ? 'denied' : 'error')
      setIsLocationOpen(true)
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 })
  }, [invalidateLocationIntent])

  useEffect(() => {
    if (hasInitialCoordinatesRef.current || autoLocationRequestedRef.current) return
    autoLocationRequestedRef.current = true
    requestCurrentLocation()
  }, [requestCurrentLocation])

  const selectCandidate = (candidate: LocationCandidate) => {
    invalidateLocationIntent()
    setCoordinates({ lat: candidate.lat, lng: candidate.lng })
    setLocationStatus('idle')
    setLocationName(candidate.name)
    setSelectedLocationName(candidate.name)
    setLocationQuery('')
    setCandidates([])
    setIsLocationOpen(false)
    setSearchNotice(undefined)
  }

  const submitSearch = () => {
    if (!coordinates) {
      setSearchNotice('検索地点を選んでください。現在地を使うか、駅名・地名から選べます。')
      setIsLocationOpen(true)
      return
    }
    setSearchNotice(undefined)
    void navigate({
      to: '/search',
      search: {
        preview: undefined,
        mode,
        category,
        walkMinutes: mode === 'nearby' ? walkMinutes : undefined,
        freeTime: mode === 'free-time' ? timeMinutes[timePosition] : undefined,
        lat: coordinates?.lat,
        lng: coordinates?.lng,
        name: coordinates ? selectedLocationName : undefined,
        area: locationName,
      },
    })
  }

  if (preview === 'states' && UiPreview) return <Suspense fallback={<LoadingState />}><UiPreview /></Suspense>
  return (
    <div className="home-screen">
      <header className="home-header"><h1 className="brand">いまひま？</h1><Link className="home-favorites-link" to="/favorites">お気に入り</Link></header>
      <div className="home-form">
        <div className="home-modes" role="group" aria-label="検索モード">
          <button type="button" aria-pressed={mode === 'nearby'} onClick={() => setMode('nearby')}>近くから探す</button>
          <button type="button" aria-pressed={mode === 'free-time'} onClick={() => setMode('free-time')}>暇つぶしから探す</button>
        </div>
        {mode === 'free-time' && <fieldset className="choice-group time-field">
          <legend><Icon name="clock" />空き時間</legend>
          <TimeRange labels={timeLabels} value={timePosition} onChange={setTimePosition} />
        </fieldset>}
        <fieldset className="choice-group area-field">
          <legend><Icon name="pin" />エリア</legend>
          <button type="button" className="field-inset area-control" aria-expanded={isLocationOpen} aria-controls="location-options" onClick={() => setIsLocationOpen((open) => !open)}>
            <Icon name="map" /><span>{locationName}</span><Icon name="down" />
          </button>
          {locationStatusMessage(locationStatus) && <p className="location-status" role="status">{locationStatusMessage(locationStatus)}</p>}
          {isLocationOpen && <div id="location-options" className="location-options">
            <div className="location-actions">
              <label className="location-search-field"><span className="visually-hidden">駅名・地名を検索</span><Search className="location-search-icon" aria-hidden="true" /><input type="search" value={locationQuery} onChange={(event) => { invalidateLocationIntent(); setLocationStatus('idle'); const nextQuery = event.target.value; setLocationQuery(nextQuery); if (nextQuery.trim().length < 2) { setCandidates([]); setCandidateStatus('idle') } }} placeholder="駅名・地名で検索" /></label>
              <button type="button" className="location-button" onClick={requestCurrentLocation} aria-label="現在地を使う" title="現在地を使う"><MapPinPlus aria-hidden="true" /></button>
            </div>
            {locationQuery.trim().length >= 2 && <div className="location-candidates" aria-live="polite">
              {candidateStatus === 'loading' && <LoadingState title="候補を読み込んでいます" />}
              {candidateStatus === 'error' && <p className="text-muted">候補を取得できませんでした。</p>}
              {candidateStatus === 'idle' && candidates.map((candidate) => <button type="button" key={`${candidate.name}|${candidate.area}|${candidate.lat}|${candidate.lng}`} onClick={() => selectCandidate(candidate)}><strong>{candidate.name}</strong><span>{candidate.area}</span></button>)}
              {candidateStatus === 'idle' && candidates.length === 0 && <p className="text-muted">候補が見つかりません。</p>}
            </div>}
          </div>}
        </fieldset>
        <fieldset className="choice-group category-field">
          <legend><LayoutGrid className="category-lucide-icon" aria-hidden="true" />カテゴリ</legend>
          <div className="field-inset category-grid">{categories.map(({ label, icon: CategoryIcon }) => <ChoiceChip key={label} selected={category === label} onClick={() => setCategory(label)} icon={<CategoryIcon className="category-lucide-icon" aria-hidden="true" />}>{label}</ChoiceChip>)}</div>
        </fieldset>
        {searchNotice && <p className="home-search-notice" role="alert">{searchNotice}</p>}
        <button className={`${buttonClassName()} button--arrow home-search`} type="button" onClick={submitSearch}><span>この条件で探す</span><ButtonArrow /></button>
      </div>
    </div>
  )
}
