import { createFileRoute, useNavigate } from '@tanstack/react-router'
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
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { buttonClassName, ButtonArrow } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { ChoiceChip } from '../components/ui/Chip'
import { TimeRange } from '../components/ui/TimeRange'
import { LoadingState } from '../components/feedback/States'

const UiPreview = import.meta.env.DEV ? lazy(() => import('../components/dev/UiPreview').then(module => ({ default: module.UiPreview }))) : null

export const Route = createFileRoute('/')({ component: Home })
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

type LocationCandidate = { name: string; area: string; lat: number; lng: number }
type LocationStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'unsupported' | 'error'

function Home() {
  const navigate = useNavigate({ from: '/' })
  const [mode, setMode] = useState<'nearby' | 'free-time'>('nearby')
  const [category, setCategory] = useState('すべて')
  const [timePosition, setTimePosition] = useState(2)
  const [locationName, setLocationName] = useState('現在地周辺')
  const [selectedLocationName, setSelectedLocationName] = useState('現在地')
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }>()
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [locationQuery, setLocationQuery] = useState('')
  const [candidates, setCandidates] = useState<LocationCandidate[]>([])
  const [candidateStatus, setCandidateStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [isLocationOpen, setIsLocationOpen] = useState(false)
  const { preview } = Route.useSearch()

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
      return
    }
    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(async (position) => {
      const nextCoordinates = { lat: position.coords.latitude, lng: position.coords.longitude }
      setCoordinates(nextCoordinates)
      setLocationStatus('granted')
      setLocationName('現在地周辺')
      setSelectedLocationName('現在地')
      try {
        const response = await fetch(`/api/location/reverse?lat=${nextCoordinates.lat}&lng=${nextCoordinates.lng}`)
        const data: unknown = await response.json()
        if (response.ok && typeof data === 'object' && data !== null && 'name' in data && typeof data.name === 'string') setLocationName(data.name)
      } catch {
        // Keep the usable fallback label when reverse geocoding fails.
      }
    }, (error) => setLocationStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error'), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 })
  }, [])

  const selectCandidate = (candidate: LocationCandidate) => {
    setCoordinates({ lat: candidate.lat, lng: candidate.lng })
    setLocationName(candidate.name)
    setSelectedLocationName(candidate.name)
    setLocationQuery('')
    setCandidates([])
    setIsLocationOpen(false)
  }

  const submitSearch = () => {
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
      <h1 className="brand">いまひま？</h1>
      <div className="home-form">
        <div className="home-modes" role="group" aria-label="検索モード">
          <button type="button" aria-pressed={mode === 'nearby'} onClick={() => setMode('nearby')}>近くから探す</button>
          <button type="button" aria-pressed={mode === 'free-time'} onClick={() => setMode('free-time')}>暇つぶしから探す</button>
        </div>
        <fieldset className="choice-group area-field">
          <legend><Icon name="pin" />エリア</legend>
          <button type="button" className="field-inset area-control" aria-expanded={isLocationOpen} aria-controls="location-options" onClick={() => setIsLocationOpen((open) => !open)}>
            <Icon name="map" /><span>{locationName}</span><Icon name="down" />
          </button>
          {isLocationOpen && <div id="location-options" className="location-options">
            <div className="location-actions">
              <label className="location-search-field"><span className="visually-hidden">駅名・地名を検索</span><Search className="location-search-icon" aria-hidden="true" /><input type="search" value={locationQuery} onChange={(event) => { const nextQuery = event.target.value; setLocationQuery(nextQuery); if (nextQuery.trim().length < 2) { setCandidates([]); setCandidateStatus('idle') } }} placeholder="駅名・地名で検索" /></label>
              <button type="button" className="location-button" onClick={requestCurrentLocation} disabled={locationStatus === 'loading'} aria-label={locationStatus === 'loading' ? '現在地を確認中' : '現在地を使う'} title="現在地を使う"><MapPinPlus aria-hidden="true" /></button>
            </div>
            {locationQuery.trim().length >= 2 && <div className="location-candidates" aria-live="polite">
              {candidateStatus === 'loading' && <LoadingState title="候補を読み込んでいます" />}
              {candidateStatus === 'error' && <p className="text-muted">候補を取得できませんでした。</p>}
              {candidateStatus === 'idle' && candidates.map((candidate) => <button type="button" key={`${candidate.name}|${candidate.area}`} onClick={() => selectCandidate(candidate)}><strong>{candidate.name}</strong><span>{candidate.area}</span></button>)}
              {candidateStatus === 'idle' && candidates.length === 0 && <p className="text-muted">候補が見つかりません。</p>}
            </div>}
          </div>}
        </fieldset>
        <fieldset className="choice-group category-field">
          <legend><LayoutGrid className="category-lucide-icon" aria-hidden="true" />カテゴリ</legend>
          <div className="field-inset category-grid">{categories.map(({ label, icon: CategoryIcon }) => <ChoiceChip key={label} selected={category === label} onClick={() => setCategory(label)} icon={<CategoryIcon className="category-lucide-icon" aria-hidden="true" />}>{label}</ChoiceChip>)}</div>
        </fieldset>
        {mode === 'free-time' && <fieldset className="choice-group time-field">
          <legend><Icon name="clock" />空き時間</legend>
          <TimeRange labels={timeLabels} value={timePosition} onChange={setTimePosition} />
        </fieldset>}
        <button className={`${buttonClassName()} button--arrow home-search`} type="button" onClick={submitSearch}><span>この条件で探す</span><ButtonArrow /></button>
      </div>
    </div>
  )
}
