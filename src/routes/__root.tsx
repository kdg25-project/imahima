import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { EmptyState } from '../components/feedback/States'
import { PageLayout, PageHeader } from '../components/layout/PageLayout'
import { buttonClassName } from '../components/ui/Button'

export const Route = createRootRoute({
  component: Root,
  notFoundComponent: NotFound,
  validateSearch: (search: Record<string, unknown>): { preview?: 'design' | 'states' } => ({
    preview: import.meta.env.DEV && (search.preview === 'design' || search.preview === 'states') ? search.preview : undefined,
  }),
})
function NotFound() {
  return <div className="fallback-page"><PageHeader title="ページが見つかりません" /><EmptyState title="お探しのページはありません" description="URLをご確認いただくか、ホームへ戻ってください。" action={<Link className={buttonClassName()} to="/">ホームへ戻る</Link>} /></div>
}
function Root() {
  return <PageLayout><a className="skip-link" href="#main-content">本文へ移動</a><main id="main-content" tabIndex={-1}><Outlet /></main></PageLayout>
}
