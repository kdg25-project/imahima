import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../feedback/States'
import { Card } from '../ui/Card'
import type { HealthResponse } from '../../../shared/health'

// Existing health-check behavior lives only in the development panel, not in the design.
export function UiPreview() {
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/health', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Health check failed')
      const data: HealthResponse = await response.json()
      if (data.status !== 'ok') throw new Error('Invalid health response')
      if (!controller.signal.aborted) setStatus('ok')
    }).catch(() => { if (!controller.signal.aborted) setStatus('error') })
    return () => controller.abort()
  }, [attempt])
  return <div className="fallback-page stack"><h1>状態UIプレビュー</h1><Card><LoadingState /></Card><Card><ErrorState onRetry={() => { setStatus('loading'); setAttempt(n => n + 1) }} /></Card><Card><EmptyState action={<Link to="/">条件を変更</Link>} /></Card><section aria-label="接続状況"><h2>接続状況</h2>{status === 'loading' ? <LoadingState title="接続を確認しています" /> : status === 'error' ? <ErrorState title="接続できませんでした" onRetry={() => { setStatus('loading'); setAttempt(n => n + 1) }} /> : <p role="status">接続できました</p>}</section><Link to="/">ホームへ戻る</Link></div>
}
