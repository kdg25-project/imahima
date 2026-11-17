import { createFileRoute, Link } from '@tanstack/react-router'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ErrorState, EmptyState, LoadingState } from '../components/feedback/States'
import { PlaceMap } from '../components/maps/PlaceMap'
import { PlaceCard } from '../components/places/PlaceCard'
import { PlacePhoto } from '../components/places/PlacePhoto'
import { ResultsLayout } from '../components/places/ResultsLayout'
import { buttonClassName, ButtonArrow } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { FavoriteButton } from '../features/favorites'
import { categoryToApiValue, displayPlaceCategory, formatDistance, formatWalkingDuration, getSearch, type SearchResult } from '../lib/api'
import { hasSearchCoordinates, parseSearchParams, searchSummary } from '../lib/search-params'

const DesignPreview = import.meta.env.DEV ? lazy(() => import('../components/dev/DesignPreview').then(module => ({ default: module.ResultsPreview }))) : null
export const Route = createFileRoute('/search')({
  validateSearch: parseSearchParams,
  component: Search,
})

type SearchState = { status: 'loading' } | { status: 'ready'; result: SearchResult } | { status: 'error' }

function weatherLabel(weather: SearchResult['weather']) {
  const precipitation = weather.precipitation > 0 ? `・降水 ${weather.precipitation}mm` : ''
  return `${Math.round(weather.temperature)}℃${precipitation}`
}

function Search() {
  const search = Route.useSearch()
  const { preview } = search
  const [requestId, setRequestId] = useState(0)
  const [state, setState] = useState<SearchState>({ status: 'loading' })
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>()
  const cardRefs = useRef(new Map<string, HTMLDivElement>())
  const canSearch = hasSearchCoordinates(search)
  const searchKey = useMemo(() => JSON.stringify(search), [search])
  const { category: categoryLabel, freeTime, lat, lng, mode, walkMinutes } = search

  const retry = useCallback(() => setRequestId((value) => value + 1), [])

  useEffect(() => {
    if (!canSearch || lat === undefined || lng === undefined) return
    const controller = new AbortController()
    const load = async () => {
      setState({ status: 'loading' })
      try {
        const result = await getSearch({ coordinates: { lat, lng }, mode, category: categoryToApiValue(categoryLabel), duration: mode === 'free-time' ? freeTime : undefined, walkMinutes: mode === 'nearby' ? walkMinutes : undefined, signal: controller.signal })
        if (!controller.signal.aborted) setState({ status: 'ready', result })
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error' })
      }
    }
    void load()
    return () => controller.abort()
  }, [canSearch, categoryLabel, freeTime, lat, lng, mode, requestId, searchKey, walkMinutes])

  const places = state.status === 'ready' ? state.result.places : []
  const effectiveSelectedPlaceId = selectedPlaceId && places.some((place) => place.id === selectedPlaceId)
    ? selectedPlaceId
    : undefined
  useEffect(() => {
    if (!effectiveSelectedPlaceId) return
    const card = cardRefs.current.get(effectiveSelectedPlaceId)
    card?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    card?.querySelector<HTMLAnchorElement>('a')?.focus({ preventScroll: true })
  }, [effectiveSelectedPlaceId])

  if (preview === 'design' && DesignPreview) return <Suspense fallback={<LoadingState />}><DesignPreview /></Suspense>
  const mapPlaces = places.flatMap((place) => place.id && place.name && place.location ? [{ id: place.id, name: place.name, location: place.location }] : [])
  return <ResultsLayout summary={`${searchSummary(search)}${state.status === 'ready' ? `・${weatherLabel(state.result.weather)}` : ''}`} changeAction={<Link className={buttonClassName('secondary', 'small')} to="/" search={{ ...search, preview: undefined, from: undefined }}><Icon name="filters" />条件を変更</Link>} map={<PlaceMap className="search-map" origin={canSearch ? { lat: search.lat, lng: search.lng } : undefined} places={mapPlaces} selectedPlaceId={effectiveSelectedPlaceId} onSelectPlace={setSelectedPlaceId} />}>
    <h2>おすすめスポット</h2>
    {mode === 'free-time' && <p className="text-muted">往復移動と滞在時間を考慮して、空き時間に収まる候補だけを表示しています。</p>}
    {!canSearch && <EmptyState title="検索地点を選んでください" description="ホームで現在地を使うか、駅名・地名から地点を選んでください。" action={<Link className={buttonClassName()} to="/">ホームで地点を選ぶ</Link>} />}
    {canSearch && state.status === 'loading' && <LoadingState title="周辺のスポットを探しています" />}
    {canSearch && state.status === 'error' && <ErrorState title="検索結果を取得できませんでした" onRetry={retry} />}
    {canSearch && state.status === 'ready' && <>
      {places.length === 0 && <EmptyState title="条件に合う候補が見つかりませんでした" description="時間やカテゴリ、地点を変更して、もう一度探してみてください。" />}
      <div className="place-list" aria-live="polite">
        {places.map((place) => {
          if (!place.id || !place.name) return null
          return <div key={place.id} ref={(element) => { if (element) cardRefs.current.set(place.id!, element); else cardRefs.current.delete(place.id!) }} className={effectiveSelectedPlaceId === place.id ? 'place-card-selection' : undefined}><PlaceCard place={{ name: place.name, category: displayPlaceCategory(place.category) ?? undefined, distanceLabel: place.distance === null ? undefined : `直線距離 ${formatDistance(place.distance)}`, durationLabel: place.walkingDurationSeconds === null ? undefined : formatWalkingDuration(place.walkingDurationSeconds) }} media={place.photos[0] ? <PlacePhoto photo={place.photos[0]} alt={`${place.name}の写真`} width={800} /> : undefined} action={<div className="place-card__actions"><FavoriteButton placeId={place.id} className="favorite-button" /><Link className={`${buttonClassName('primary', 'small')} button--arrow`} to="/places/$placeId" params={{ placeId: place.id }} search={{ ...search, preview: undefined }}><span>詳細を見る</span><ButtonArrow size="small" /></Link></div>} >
            <p className="place-card__reason">{place.reason}・おすすめ度 {place.score.toFixed(0)}点</p>
            {place.availableStayMinutes !== null && <p className="place-card__stay">現地で過ごせる目安：{place.availableStayMinutes}分</p>}
          </PlaceCard></div>
        })}
      </div>
    </>}
  </ResultsLayout>
}
