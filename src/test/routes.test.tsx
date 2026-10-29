// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from '../routeTree.gen'

function renderRoute(path: string) {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => vi.stubGlobal('scrollTo', vi.fn()))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('画面の土台', () => {
  it('モードで空き時間を出し分け、カテゴリと時間の選択を保持する', async () => {
    renderRoute('/')
    const user = userEvent.setup()
    const nearby = await screen.findByRole('button', { name: '近くから探す' })
    const freeTime = screen.getByRole('button', { name: '暇つぶしから探す' })
    expect(nearby.getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('slider', { name: '空き時間' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'カフェ' }))
    await user.click(freeTime)
    const slider = screen.getByRole('slider', { name: '空き時間' })
    fireEvent.change(slider, { target: { value: '3' } })
    expect(slider.getAttribute('aria-valuetext')).toBe('2時間')
    await user.click(nearby)
    expect(screen.queryByRole('slider')).toBeNull()
    await user.click(freeTime)
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('2時間')
    expect(screen.getByRole('button', { name: 'カフェ' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('詳細URLを直接開き、検索結果とホームに戻れる', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) }))
    const router = renderRoute('/places/test-place')
    const user = userEvent.setup()
    expect(await screen.findByRole('heading', { level: 1, name: 'スポット詳細' })).toBeTruthy()
    await user.click(screen.getByRole('link', { name: '検索結果へ戻る' }))
    expect(await screen.findByRole('heading', { level: 1, name: '検索結果' })).toBeTruthy()
    await user.click(screen.getByRole('link', { name: '条件を変更' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('未知のURLでは404とホームへのリンクを表示する', async () => {
    renderRoute('/missing-page')
    expect(await screen.findByRole('heading', { level: 1, name: 'ページが見つかりません' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'ホームへ戻る' }).getAttribute('href')).toBe('/')
  })

  it('接続失敗後の再試行が実際に再取得して成功表示へ変わる', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) })
    vi.stubGlobal('fetch', fetchMock)
    renderRoute('/?preview=states')
    const user = userEvent.setup()
    expect(await screen.findByText('接続できませんでした')).toBeTruthy()
    await user.click(within(screen.getByRole('region', { name: '接続状況' })).getByRole('button', { name: '再試行' }))
    expect(await screen.findByText('接続できました')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
