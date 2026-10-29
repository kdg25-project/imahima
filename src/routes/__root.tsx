import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: Root,
  notFoundComponent: () => <><h1>ページが見つかりません</h1><Link to="/">ホームへ戻る</Link></>,
})

function Root() {
  return (
    <div className="container">
      <header>
        <Link to="/">いまひま</Link>
        <nav aria-label="メインナビゲーション">
          <Link to="/">ホーム</Link>
          <Link to="/search" search={{ lat: undefined, lng: undefined, name: undefined, area: undefined }}>検索</Link>
        </nav>
      </header>
      <main><Outlet /></main>
    </div>
  )
}
