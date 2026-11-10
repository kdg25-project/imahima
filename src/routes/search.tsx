import { createFileRoute, Link } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { EmptyState, LoadingState } from '../components/feedback/States'
import { ResultsLayout } from '../components/places/ResultsLayout'
import { buttonClassName } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'

const DesignPreview = import.meta.env.DEV ? lazy(() => import('../components/dev/DesignPreview').then(module => ({ default: module.ResultsPreview }))) : null
function parseNumber(value: unknown): number | undefined {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>) => ({
    preview: typeof search.preview === 'string' ? search.preview : undefined,
    mode: search.mode === 'free-time' ? 'free-time' as const : 'nearby' as const,
    category: typeof search.category === 'string' ? search.category : 'すべて',
    walkMinutes: parseNumber(search.walkMinutes),
    freeTime: parseNumber(search.freeTime),
    area: typeof search.area === 'string' ? search.area : '現在地周辺',
    lat: parseNumber(search.lat),
    lng: parseNumber(search.lng),
    name: typeof search.name === 'string' ? search.name : undefined,
  }),
  component: Search,
})
function Search() {
  const { preview, mode, category, walkMinutes, freeTime, area } = Route.useSearch()
  if (preview === 'design' && DesignPreview) return <Suspense fallback={<LoadingState />}><DesignPreview /></Suspense>
  return <ResultsLayout changeAction={<Link className={buttonClassName('secondary', 'small')} to="/"><Icon name="filters" />条件を変更</Link>} map={<div className="map-placeholder">検索地点を選んでください</div>}>
    <h2>おすすめスポット</h2>
    <p className="text-muted">{mode === 'free-time' ? '暇つぶしから探す' : '近くから探す'} / {area} / {category}{mode === 'nearby' && walkMinutes ? ` / 徒歩${walkMinutes}分圏内` : ''}{freeTime ? ` / 空き時間${freeTime}分` : ''}</p>
    <EmptyState title="検索機能を準備中です" description="検索条件を受け取りました。結果表示は次の対応で追加します。" action={<Link className={buttonClassName()} to="/">ホームへ戻る</Link>} />
  </ResultsLayout>
}
