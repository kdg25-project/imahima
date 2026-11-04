import { createFileRoute, Link } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { EmptyState, LoadingState } from '../components/feedback/States'
import { ResultsLayout } from '../components/places/ResultsLayout'
import { buttonClassName } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'

const DesignPreview = import.meta.env.DEV ? lazy(() => import('../components/dev/DesignPreview').then(module => ({ default: module.ResultsPreview }))) : null
export const Route = createFileRoute('/search')({ component: Search })
function Search() {
  const { preview } = Route.useSearch()
  if (preview === 'design' && DesignPreview) return <Suspense fallback={<LoadingState />}><DesignPreview /></Suspense>
  return <ResultsLayout changeAction={<Link className={buttonClassName('secondary', 'small')} to="/"><Icon name="filters" />条件を変更</Link>} map={<div className="map-placeholder">検索地点を選んでください</div>}>
    <h2>おすすめスポット</h2><EmptyState title="検索条件を選択してください" description="検索機能は準備中です。" action={<Link className={buttonClassName()} to="/">ホームへ戻る</Link>} />
  </ResultsLayout>
}
