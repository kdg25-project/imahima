import { createFileRoute, Link } from '@tanstack/react-router'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { ErrorState, LoadingState } from '../../components/feedback/States'
import { DetailRow, DetailsLayout } from '../../components/places/DetailsLayout'
import { DetailInfoCards } from '../../components/places/DetailInfoCards'
import { DetailPhotoGallery, DetailPhotoHero, DetailPhotoViewer } from '../../components/places/DetailPhotoGallery'
import { DetailSummary } from '../../components/places/DetailSummary'
import { DetailTabs, type DetailTab } from '../../components/places/DetailTabs'
import { PlaceMap } from '../../components/maps/PlaceMap'
import { buttonClassName } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { displayPlaceCategory, formatDistance, formatWalkingDuration, getPlaceDetails, getWalkingRoute, type PlaceDetails, type WalkingRoute } from '../../lib/api'
import { hasSearchCoordinates, parseSearchParams } from '../../lib/search-params'
import { FavoriteButton } from '../../features/favorites'
import back from '../../assets/icons/back.svg'

const DesignPreview = import.meta.env.DEV ? lazy(() => import('../../components/dev/DesignPreview').then(module => ({ default: module.DetailsPreview }))) : null
export const Route = createFileRoute('/places/$placeId')({ validateSearch: parseSearchParams, component: PlaceDetails })

type DetailState = { status: 'loading' } | { status: 'ready'; place: PlaceDetails; route?: WalkingRoute; routeUnavailable: boolean } | { status: 'error' }

function PlaceDetails() {
  const search = Route.useSearch()
  const { placeId } = Route.useParams()
  const { lat, lng } = search
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<DetailState>({ status: 'loading' })
  const [activeTab, setActiveTab] = useState<DetailTab>('map')
  const [galleryOpener, setGalleryOpener] = useState<HTMLButtonElement | null>(null)
  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      await Promise.resolve()
      if (controller.signal.aborted) return
      setState({ status: 'loading' })
      try {
        const place = await getPlaceDetails(placeId, { signal: controller.signal })
        if (controller.signal.aborted) return
        let route: WalkingRoute | undefined
        let routeUnavailable = false
        if (hasSearchCoordinates(search) && lat !== undefined && lng !== undefined && place.location) {
          try {
            route = await getWalkingRoute({ origin: { lat, lng }, destination: place.location, signal: controller.signal })
          } catch {
            if (controller.signal.aborted) return
            routeUnavailable = true
          }
        }
        if (!controller.signal.aborted) setState({ status: 'ready', place, route, routeUnavailable })
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error' })
      }
    }
    void load()
    return () => controller.abort()
  }, [attempt, lat, lng, placeId, search])

  const backAction = search.from === 'favorites'
    ? <Link className="back-link" to="/favorites" aria-label="お気に入りへ戻る"><img src={back} alt="" /></Link>
    : <Link className="back-link" to="/search" search={{ ...search, preview: undefined, from: undefined }} aria-label="検索結果へ戻る"><img src={back} alt="" /></Link>
  const preview = search.preview
  if (preview === 'design' && DesignPreview) return <Suspense fallback={<LoadingState />}><DesignPreview /></Suspense>
  if (state.status === 'loading') return <DetailsLayout backAction={backAction} hero={<div className="hero-placeholder">スポット情報を読み込んでいます</div>}><LoadingState title="スポット情報を読み込んでいます" /></DetailsLayout>
  if (state.status === 'error') return <DetailsLayout backAction={backAction} hero={<div className="hero-placeholder">スポットの写真は利用できません</div>}><ErrorState title="スポット情報を取得できませんでした" onRetry={retry} /></DetailsLayout>
  const { place, route, routeUnavailable } = state
  const placeName = place.name ?? 'スポット'
  const tags = [
    ...(place.category ? [{ label: displayPlaceCategory(place.category) ?? place.category }] : []),
    ...(place.openNow === true ? [{ label: '営業中', tone: 'positive' as const }] : place.openNow === false ? [{ label: '営業時間外' }] : []),
  ]
  const directions = new URLSearchParams({
    api: '1',
    destination: place.location ? `${place.location.lat},${place.location.lng}` : place.name ?? placeId,
    destination_place_id: place.id ?? placeId,
    travelmode: 'walking',
  })
  if (hasSearchCoordinates(search)) directions.set('origin', `${search.lat},${search.lng}`)
  const mapSearch = place.location
    ? `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: `${place.name ?? ''} ${place.location.lat},${place.location.lng}` })}`
    : undefined
  return <DetailsLayout backAction={backAction} hero={place.photos[0] ? <DetailPhotoHero photo={place.photos[0]} placeName={placeName} onOpen={setGalleryOpener} /> : <div className="hero-placeholder">スポットの写真は利用できません</div>}>
    <DetailSummary name={place.name ?? '名称未設定のスポット'} tags={tags} rating={place.rating?.toFixed(1)} />
    {place.id && <div className="detail-favorite"><FavoriteButton placeId={place.id} className="favorite-button" /></div>}
    {place.photos.length > 1 && <DetailPhotoGallery photos={place.photos} placeName={placeName} onOpen={setGalleryOpener} />}
    <div className="detail-walking">
      {route && <DetailRow icon="walk">{search.name ?? search.area}から{formatDistance(route.distanceMeters)}（{formatWalkingDuration(route.durationSeconds)}）</DetailRow>}
      {!route && hasSearchCoordinates(search) && routeUnavailable && <DetailRow icon="walk">徒歩経路を取得できませんでした</DetailRow>}
      {!hasSearchCoordinates(search) && <DetailRow icon="walk">検索地点を選ぶと徒歩経路を確認できます</DetailRow>}
    </div>
    <DetailInfoCards />
    <DetailTabs activeTab={activeTab} onChange={setActiveTab} />
    <div className="detail-tab-panel" role="tabpanel" id={`detail-panel-${activeTab}`} aria-labelledby={`detail-tab-${activeTab}`}>
      {activeTab === 'map' && <div className="detail-map-wrap"><PlaceMap className="detail-map" place={{ name: place.name, location: place.location }} />{mapSearch && <a className="detail-map-expand" href={mapSearch} target="_blank" rel="noreferrer">地図を広げる</a>}</div>}
      {activeTab === 'menu' && <p className="detail-empty">メニュー情報はまだありません。</p>}
      {activeTab === 'reviews' && <p className="detail-empty">口コミ情報はまだありません。</p>}
      {activeTab === 'facility' && <div className="detail-info">{place.address ? <DetailRow icon="pinDetail">{place.address}</DetailRow> : <p className="detail-empty">施設情報はまだありません。</p>}</div>}
    </div>
    <a className={`${buttonClassName()} route-button`} href={`https://www.google.com/maps/dir/?${directions}`} target="_blank" rel="noreferrer">経路を検索<Icon name="direction" /></a>
    {galleryOpener && <DetailPhotoViewer photos={place.photos} placeName={placeName} opener={galleryOpener} onClose={() => setGalleryOpener(null)} />}
  </DetailsLayout>
}
