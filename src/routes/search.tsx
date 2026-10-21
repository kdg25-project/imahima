import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/search')({ component: Search })

function Search() {
  return <><h1>検索</h1><p>検索機能は今後実装します。</p><Link to="/">ホームへ戻る</Link></>
}
