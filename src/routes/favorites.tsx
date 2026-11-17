import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { PageHeader } from '../components/layout/PageLayout'
import { PlaceCard } from '../components/places/PlaceCard'
import { PlacePhoto } from '../components/places/PlacePhoto'
import { buttonClassName } from '../components/ui/Button'
import { ApiError, displayPlaceCategory, getPlaceDetails } from '../lib/api'
import { FavoriteButton, type FavoriteRecord, useFavorites } from '../features/favorites'
import '../features/favorites/favorites.css'

type LoadedFavorite = {
  record: FavoriteRecord
  place: Awaited<ReturnType<typeof getPlaceDetails>>
}

type FailedFavorite = {
  record: FavoriteRecord
  message: string
}

type FavoritesLoadState =
  { requestKey: string; loaded: LoadedFavorite[]; failed: FailedFavorite[] }

export const Route = createFileRoute('/favorites')({ component: Favorites })

async function loadWithConcurrency<T, R>(items: readonly T[], limit: number, load: (item: T, signal: AbortSignal) => Promise<R>, signal: AbortSignal) {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (!signal.aborted) {
      const index = nextIndex++
      if (index >= items.length) return
      try {
        results[index] = { status: 'fulfilled', value: await load(items[index], signal) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

function errorMessage(reason: unknown) {
  if (reason instanceof ApiError && reason.status === 404) return 'このスポットは利用できなくなったようです。削除できます。'
  if (reason instanceof ApiError && reason.status === 0) return '通信できませんでした。'
  return '情報を読み込めませんでした。'
}

function Favorites() {
  const { favorites, removeFavorite, storageAvailable } = useFavorites()
  const [loadState, setLoadState] = useState<FavoritesLoadState>({ requestKey: '', loaded: [], failed: [] })
  const [retryToken, setRetryToken] = useState(0)
  const favoriteKey = favorites.map((favorite) => `${favorite.placeId}:${favorite.addedAt}`).join('|')
  const requestKey = `${favoriteKey}:${retryToken}`
  const isLoading = favorites.length > 0 && loadState.requestKey !== requestKey

  useEffect(() => {
    const controller = new AbortController()

    if (favorites.length === 0) {
      return () => controller.abort()
    }

    void loadWithConcurrency(favorites, 4, (favorite, signal) => getPlaceDetails(favorite.placeId, { signal }), controller.signal)
      .then((results) => {
        if (controller.signal.aborted) return
        const loaded: LoadedFavorite[] = []
        const failed: FailedFavorite[] = []
        results.forEach((result, index) => {
          const record = favorites[index]
          if (!record || !result) return
          if (result.status === 'fulfilled') loaded.push({ record, place: result.value })
          else if (!(result.reason instanceof DOMException && result.reason.name === 'AbortError')) failed.push({ record, message: errorMessage(result.reason) })
        })
        setLoadState({ requestKey, loaded, failed })
      })

    return () => controller.abort()
  }, [favorites, requestKey])

  const retry = () => {
    setRetryToken((current) => current + 1)
  }

  return <div className="favorites-screen">
    <PageHeader title="お気に入り" action={<Link className={buttonClassName('secondary', 'small')} to="/">ホームへ</Link>} />
    {!storageAvailable && <p className="favorites-screen__notice" role="alert">この端末では保存できないため、お気に入りはブラウザーを閉じるまでの表示です。</p>}
    {isLoading && <LoadingState title="お気に入りを読み込んでいます" />}
    {!isLoading && favorites.length === 0 && <EmptyState title="お気に入りはまだありません" description="気になるスポットを保存すると、ここからすぐに開けます。" action={<Link className={buttonClassName()} to="/">スポットを探す</Link>} />}
    {!isLoading && favorites.length > 0 && <>
      {loadState.loaded.length > 0 && <div className="place-list" aria-label="保存したスポット">
        {loadState.loaded.map(({ record, place }) => <PlaceCard
          key={record.placeId}
          place={{
            name: place.name ?? '名称不明のスポット',
            category: displayPlaceCategory(place.category) ?? undefined,
          }}
          media={place.photos[0] ? <PlacePhoto photo={place.photos[0]} alt={`${place.name ?? 'スポット'}の写真`} /> : undefined}
          action={<div className="favorites-screen__actions">
            <FavoriteButton placeId={record.placeId} className="favorite-button" />
            <Link className={buttonClassName('primary', 'small')} to="/places/$placeId" params={{ placeId: record.placeId }} search={{ mode: 'nearby', category: 'すべて', walkMinutes: 15, area: '現在地周辺', from: 'favorites' }}>詳細</Link>
          </div>}
        />)}
      </div>}
      {loadState.failed.length > 0 && <div className="stack" aria-label="取得できなかったお気に入り">
        {loadState.loaded.length > 0 && <p className="favorites-screen__notice">一部のスポットを読み込めませんでした。</p>}
        {loadState.failed.map(({ record, message }) => <ErrorState
          key={record.placeId}
          title="スポットを表示できません"
          description={message}
          onRetry={retry}
          action={<button type="button" className={buttonClassName('secondary', 'small')} onClick={() => removeFavorite(record.placeId)}>お気に入りから削除</button>}
        />)}
      </div>}
    </>}
  </div>
}
