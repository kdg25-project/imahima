import { createFileRoute, Link } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { EmptyState, LoadingState } from '../../components/feedback/States'
import { DetailsLayout } from '../../components/places/DetailsLayout'
import back from '../../assets/icons/back.svg'

const DesignPreview = import.meta.env.DEV ? lazy(() => import('../../components/dev/DesignPreview').then(module => ({ default: module.DetailsPreview }))) : null
export const Route = createFileRoute('/places/$placeId')({ component: PlaceDetails })
function PlaceDetails() {
  const { preview } = Route.useSearch()
  if (preview === 'design' && DesignPreview) return <Suspense fallback={<LoadingState />}><DesignPreview /></Suspense>
  return <DetailsLayout backAction={<Link className="back-link" to="/search" aria-label="検索結果へ戻る"><img src={back} alt="" /></Link>}>
    <h1>スポット詳細</h1><EmptyState title="スポット情報を準備しています" description="名称・営業時間・アクセス情報は、詳細機能の実装後に表示されます。" />
  </DetailsLayout>
}
