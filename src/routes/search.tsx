import { createFileRoute, Link } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { EmptyState, LoadingState } from '../components/feedback/States'
import { ResultsLayout } from '../components/places/ResultsLayout'
import { buttonClassName } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'

const DesignPreview = import.meta.env.DEV ? lazy(() => import('../components/dev/DesignPreview').then(module => ({ default: module.ResultsPreview }))) : null
function parseCoordinate(value: unknown): number | undefined {
  const coordinate = Number(value)
  return Number.isFinite(coordinate) ? coordinate : undefined
}

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>) => ({
    preview: typeof search.preview === 'string' ? search.preview : undefined,
    lat: parseCoordinate(search.lat),
    lng: parseCoordinate(search.lng),
    name: typeof search.name === 'string' ? search.name : undefined,
    area: typeof search.area === 'string' ? search.area : undefined,
  }),
  component: Search,
})
function Search() {
  const { preview, lat, lng, name, area } = Route.useSearch()
  if (preview === 'design' && DesignPreview) return <Suspense fallback={<LoadingState />}><DesignPreview /></Suspense>
  return <ResultsLayout changeAction={<Link className={buttonClassName('secondary', 'small')} to="/"><Icon name="filters" />条件を変更</Link>} map={<div className="map-placeholder">検索地点を選んでください</div>}>
    <h2>おすすめスポット</h2>
    <p className="text-muted">{lat !== undefined && lng !== undefined && name ? `${area ?? name}を中心に検索` : '検索地点を選んでください'}</p>
    <EmptyState title="検索機能を準備中です" description="地点情報を受け取りました。検索結果は次の対応で追加します。" action={<Link className={buttonClassName()} to="/">ホームへ戻る</Link>} />
  </ResultsLayout>
}
