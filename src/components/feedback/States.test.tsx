// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyState, ErrorState, LoadingState } from './States'

afterEach(cleanup)

describe('共通状態UI', () => {
  it('読込文言をステータスとして通知する', () => {
    render(<LoadingState title="検索中です" description="少しお待ちください" />)
    expect(screen.getByRole('status').textContent).toContain('検索中です')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('エラーから再試行を委譲し、再試行中の二重操作を防ぐ', async () => {
    const onRetry = vi.fn()
    const { rerender } = render(<ErrorState onRetry={onRetry} />)
    const user = userEvent.setup()
    expect(screen.getByRole('alert').textContent).toContain('読み込めませんでした')
    await user.tab()
    await user.keyboard('{Enter}')
    expect(onRetry).toHaveBeenCalledTimes(1)
    rerender(<ErrorState onRetry={onRetry} retrying />)
    const retry = screen.getByRole('button', { name: '再試行中…' })
    expect((retry as HTMLButtonElement).disabled).toBe(true)
    await user.click(retry)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('再試行がないエラーと条件変更導線付きの空表示を提供できる', () => {
    const { rerender } = render(<ErrorState title="対象を表示できません" />)
    expect(screen.queryByRole('button')).toBeNull()
    rerender(<EmptyState action={<a href="/">条件を変更</a>} />)
    expect(screen.getByRole('status').textContent).toContain('候補が見つかりませんでした')
    expect(screen.getByRole('link', { name: '条件を変更' }).getAttribute('href')).toBe('/')
  })
})
