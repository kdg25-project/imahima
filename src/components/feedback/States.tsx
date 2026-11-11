import type { ReactNode } from 'react'
import { Button } from '../ui/Button'

type StateProps = { title?: string; description?: string; action?: ReactNode }

export function LoadingState({ title = '読み込んでいます', description }: Omit<StateProps, 'action'>) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="state__spinner" aria-hidden="true" />
      <p className="state__title">{title}</p>
      {description && <p className="text-muted">{description}</p>}
    </div>
  )
}

export function ErrorState({ title = '読み込めませんでした', description = '時間をおいて、もう一度お試しください。', onRetry, retrying = false, action }: StateProps & {
  onRetry?: () => void
  retrying?: boolean
}) {
  return (
    <div className="state state--error">
      <div role="alert">
        <p className="state__title">{title}</p>
        <p className="text-muted">{description}</p>
      </div>
      {onRetry && <Button variant="secondary" onClick={onRetry} disabled={retrying}>{retrying ? '再試行中…' : '再試行'}</Button>}
      {action}
    </div>
  )
}

export function EmptyState({ title = '候補が見つかりませんでした', description = '条件を変更して、もう一度探してみてください。', action }: StateProps) {
  return (
    <div className="state" role="status">
      <p className="state__title">{title}</p>
      <p className="text-muted">{description}</p>
      {action}
    </div>
  )
}
