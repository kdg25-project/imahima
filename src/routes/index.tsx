import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { HealthResponse } from '../../shared/health'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/health', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Health check failed')
        const data: HealthResponse = await response.json()
        if (data.status !== 'ok') throw new Error('Invalid health response')
        setStatus('ok')
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('error') })
    return () => controller.abort()
  }, [attempt])

  return (
    <>
      <h1>いまひま</h1>
      <p>開発用の環境が準備できました。</p>
      <p aria-live="polite">
        API: {status === 'loading' ? '確認中…' : status === 'ok' ? '接続できました' : '接続できませんでした'}
      </p>
      {status === 'error' && <button onClick={() => { setStatus('loading'); setAttempt((n) => n + 1) }}>再試行</button>}
      <p><Link to="/search">検索ページへ</Link></p>
    </>
  )
}
