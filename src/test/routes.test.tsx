// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { routeTree } from '../routeTree.gen'

function renderRoute(path: string, strict = false) {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) })
  render(strict ? <StrictMode><RouterProvider router={router} /></StrictMode> : <RouterProvider router={router} />)
  return router
}

function json(data: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => data }
}

let geolocationDescriptor: PropertyDescriptor | undefined

function setGeolocation(geolocation: Geolocation | undefined) {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geolocation })
}

function position(lat: number, lng: number) {
  return { coords: { latitude: lat, longitude: lng } } as GeolocationPosition
}

beforeEach(() => {
  geolocationDescriptor = Object.getOwnPropertyDescriptor(navigator, 'geolocation')
  vi.stubGlobal('scrollTo', vi.fn())
})

afterEach(() => {
  cleanup()
  if (geolocationDescriptor) Object.defineProperty(navigator, 'geolocation', geolocationDescriptor)
  else Reflect.deleteProperty(navigator, 'geolocation')
  vi.unstubAllGlobals()
})

describe('主要画面フロー', () => {
  it('地点未選択では検索せず、地点を選ぶ案内を出す', async () => {
    setGeolocation(undefined)
    const router = renderRoute('/')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'この条件で探す' }))
    expect(screen.getByRole('alert').textContent).toContain('検索地点を選んでください')
    expect(router.state.location.pathname).toBe('/')
  })

  it('実ルートに基づき徒歩圏外を除外し、詳細へ検索コンテキストを渡す', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('/api/search?')) return json({ weather: { temperature: 21, weatherCode: 1, precipitation: 0 }, places: [
        { id: 'near', name: '近いカフェ', category: 'cafe', location: { lat: 35.171, lng: 136.881 }, rating: 4.2, openNow: true, photos: [{ name: 'places/near/photos/photo-1', authorAttributions: [{ displayName: '写真提供者', uri: 'https://example.com/attribution' }] }], distance: 280, walkingDistanceMeters: 320, walkingDurationSeconds: 300, availableStayMinutes: null, score: 67, reason: '近くて行きやすい', reasons: [] },
      ] })
      return json({ error: 'not found' }, false)
    }))
    const router = renderRoute('/search?mode=nearby&category=%E3%81%99%E3%81%B9%E3%81%A6&walkMinutes=15&area=%E5%90%8D%E5%8F%A4%E5%B1%8B%E9%A7%85&lat=35.17&lng=136.88')
    expect(await screen.findByRole('heading', { level: 3, name: '近いカフェ' })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 3, name: '遠いカフェ' })).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: '近いカフェ' }))
    expect(document.querySelector('.place-card-selection')).not.toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('link', { name: '詳細を見る' }))
    await userEvent.setup().click(screen.getByRole('link', { name: '詳細を見る' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/places/near'))
    expect(router.state.location.search).toMatchObject({ lat: 35.17, lng: 136.88, area: '名古屋駅' })
  })

  it('検索結果には施設情報だけを表示する', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('/api/search?')) return json({ weather: { temperature: 21, weatherCode: 1, precipitation: 0 }, places: [
        { id: 'near', name: '近いカフェ', category: 'cafe', location: { lat: 35.171, lng: 136.881 }, rating: 4.2, openNow: true, photos: [], distance: 280, walkingDistanceMeters: 320, walkingDurationSeconds: 300, availableStayMinutes: null, score: 67, reason: '近くて行きやすい', reasons: [] },
      ] })
      return json({ error: 'not found' }, false)
    }))

    renderRoute('/search?mode=nearby&category=%E3%81%99%E3%81%B9%E3%81%A6&walkMinutes=15&area=%E5%90%8D%E5%8F%A4%E5%B1%8B%E9%A7%85&lat=35.17&lng=136.88')

    expect(await screen.findByRole('heading', { level: 3, name: '近いカフェ' })).toBeTruthy()
    expect(screen.getByText('約280m')).toBeTruthy()
    expect(screen.getByText('徒歩5分')).toBeTruthy()
    expect(screen.queryByText(/近くて行きやすい/)).toBeNull()
    expect(screen.queryByText(/おすすめ度 67点/)).toBeNull()
  })

  it('free-timeの検索条件をサーバー契約へ変換する', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('/api/search?')) return json({ weather: { temperature: 21, weatherCode: 1, precipitation: 0 }, places: [] })
      return json({ error: 'not found' }, false)
    }))

    renderRoute('/search?mode=free-time&category=%E3%81%99%E3%81%B9%E3%81%A6&freeTime=60&area=%E5%90%8D%E5%8F%A4%E5%B1%8B%E9%A7%85&lat=35.17&lng=136.88')

    await screen.findByText('条件に合う候補が見つかりませんでした')
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('mode=free-time')
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('duration=60')
  })

  it('空き時間検索では食事の30分滞在を確保できる候補だけを表示する', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('/api/search?')) return json({ weather: { temperature: 21, weatherCode: 1, precipitation: 0 }, places: [
        { id: 'exact-food', name: '30分確保できる食事', category: 'food', location: { lat: 35.172, lng: 136.882 }, rating: 4, openNow: true, photos: [], distance: 0, walkingDistanceMeters: 0, walkingDurationSeconds: 0, availableStayMinutes: 30, score: 80, reason: '空き時間に収まる', reasons: [] },
      ] })
      return json({ error: 'not found' }, false)
    }))

    renderRoute('/search?mode=free-time&category=%E3%81%94%E3%81%AF%E3%82%93&freeTime=30&area=%E5%90%8D%E5%8F%A4%E5%B1%8B%E9%A7%85&lat=35.17&lng=136.88')

    expect(await screen.findByRole('heading', { level: 3, name: '30分確保できる食事' })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 3, name: '4分しか残らない食事' })).toBeNull()
    expect(screen.getByText('現地で過ごせる目安：30分')).toBeTruthy()
    expect(screen.getByText('往復移動と滞在時間を考慮して、空き時間に収まる候補だけを表示しています。')).toBeTruthy()
  })

  it('全候補の徒歩経路を確認できない場合は再試行できるエラーを表示する', async () => {
    let routeAttempts = 0
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('/api/search?')) {
        routeAttempts += 1
        throw new Error('search unavailable')
      }
      return json({ error: 'not found' }, false)
    }))

    renderRoute('/search?mode=nearby&category=%E3%81%99%E3%81%B9%E3%81%A6&walkMinutes=15&area=%E5%90%8D%E5%8F%A4%E5%B1%8B%E9%A7%85&lat=35.17&lng=136.88')

    expect((await screen.findByRole('alert')).textContent).toContain('検索結果を取得できませんでした')
    await userEvent.setup().click(screen.getByRole('button', { name: '再試行' }))
    await waitFor(() => expect(routeAttempts).toBeGreaterThan(1))
  })

  it('詳細は取得済みの施設と徒歩経路を表示し、検索結果へ戻れる', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/places/near') return json({ id: 'near', name: '近いカフェ', category: 'bakery', location: { lat: 35.171, lng: 136.881 }, rating: 4.2, openNow: true, address: '愛知県名古屋市' })
      if (url === '/api/routes') return json({ distanceMeters: 320, durationSeconds: 300 })
      return json({ error: 'not found' }, false)
    }))
    const router = renderRoute('/places/near?mode=nearby&category=%E3%81%99%E3%81%B9%E3%81%A6&walkMinutes=15&area=%E5%90%8D%E5%8F%A4%E5%B1%8B%E9%A7%85&lat=35.17&lng=136.88')
    expect(await screen.findByRole('heading', { level: 1, name: '近いカフェ' })).toBeTruthy()
    expect(screen.getByText(/名古屋駅から320m/)).toBeTruthy()
    expect(screen.getByText('ごはん')).toBeTruthy()
    expect(screen.getAllByText('情報がありません')).toHaveLength(2)
    expect(screen.getByRole('tab', { name: '口コミ' }).textContent).toBe('口コミ')
    expect(screen.getByRole('link', { name: '経路を検索' }).getAttribute('href')).toContain('destination=35.171%2C136.881')
    expect(screen.getByRole('link', { name: '経路を検索' }).getAttribute('href')).toContain('travelmode=walking')
    const mapTab = screen.getByRole('tab', { name: '地図' })
    fireEvent.keyDown(mapTab, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'メニュー' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('メニュー情報はまだありません。')).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('tab', { name: 'メニュー' }), { key: 'End' })
    expect(screen.getByRole('tab', { name: '施設情報' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('愛知県名古屋市')).toBeTruthy()
    await userEvent.setup().click(screen.getByRole('link', { name: '検索結果へ戻る' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/search'))
  })

  it('空き時間の選択値を保つ', async () => {
    renderRoute('/')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '暇つぶしから探す' }))
    const slider = screen.getByRole('slider', { name: '空き時間' })
    fireEvent.change(slider, { target: { value: '3' } })
    expect(slider.getAttribute('aria-valuetext')).toBe('2時間')
  })

  it('条件変更でURLの地点・カテゴリ・空き時間をホームへ復元し、そのまま再検索する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ places: [] })))
    const router = renderRoute('/search?mode=free-time&category=%E3%82%AB%E3%83%95%E3%82%A7&freeTime=120&area=%E5%90%8D%E5%8F%A4%E5%B1%8B%E9%A7%85&name=%E5%90%8D%E5%8F%A4%E5%B1%8B%E9%A7%85&lat=35.17&lng=136.88')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('link', { name: '条件を変更' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(screen.getByRole('button', { name: '暇つぶしから探す' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'カフェ' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('slider', { name: '空き時間' }).getAttribute('aria-valuetext')).toBe('2時間')
    expect(screen.getByRole('button', { name: /名古屋駅/ })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'この条件で探す' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/search'))
    expect(router.state.location.search).toMatchObject({ mode: 'free-time', category: 'カフェ', freeTime: 120, lat: 35.17, lng: 136.88, name: '名古屋駅', area: '名古屋駅' })
  })

  it('初回の現在地をすぐ検索に使え、逆ジオコードの完了を待たない', async () => {
    let onSuccess: PositionCallback | undefined
    const getCurrentPosition = vi.fn((success: PositionCallback) => { onSuccess = success })
    setGeolocation({ getCurrentPosition } as unknown as Geolocation)
    let resolveReverse: ((response: ReturnType<typeof json>) => void) | undefined
    const reverseResponse = new Promise<ReturnType<typeof json>>((resolve) => { resolveReverse = resolve })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('/api/location/reverse')) return reverseResponse
      if (String(input).startsWith('/api/places?')) return json({ places: [] })
      return json({ error: 'unexpected' }, false)
    }))
    const router = renderRoute('/')
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1))
    onSuccess?.(position(35.17, 136.88))
    await waitFor(() => expect(screen.getByRole('button', { name: /現在地周辺/ })).toBeTruthy())
    await userEvent.setup().click(screen.getByRole('button', { name: 'この条件で探す' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/search'))
    expect(router.state.location.search).toMatchObject({ lat: 35.17, lng: 136.88, name: '現在地', area: '現在地周辺' })
    resolveReverse?.(json({ name: '名古屋駅周辺' }))
  })

  it('逆ジオコード失敗後も現在地の座標を検索に使える', async () => {
    let onSuccess: PositionCallback | undefined
    const getCurrentPosition = vi.fn((success: PositionCallback) => { onSuccess = success })
    setGeolocation({ getCurrentPosition } as unknown as Geolocation)
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('/api/location/reverse')) throw new Error('reverse failed')
      if (String(input).startsWith('/api/places?')) return json({ places: [] })
      return json({ error: 'unexpected' }, false)
    }))
    const router = renderRoute('/')
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1))
    onSuccess?.(position(35.17, 136.88))
    await waitFor(() => expect(screen.getByRole('button', { name: /現在地周辺/ })).toBeTruthy())
    await userEvent.setup().click(screen.getByRole('button', { name: 'この条件で探す' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/search'))
    expect(router.state.location.search).toMatchObject({ lat: 35.17, lng: 136.88, area: '現在地周辺' })
  })

  it('URLから復元した地点では現在地を自動取得しない', async () => {
    const getCurrentPosition = vi.fn()
    setGeolocation({ getCurrentPosition } as unknown as Geolocation)
    renderRoute('/?area=%E5%90%8D%E5%8F%A4%E5%B1%8B%E9%A7%85&lat=35.17&lng=136.88')
    await waitFor(() => expect(screen.getByRole('button', { name: /名古屋駅/ })).toBeTruthy())
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('古い自動現在地取得・逆ジオコードが、後から選んだ駅を上書きしない', async () => {
    let onSuccess: PositionCallback | undefined
    const getCurrentPosition = vi.fn((success: PositionCallback) => { onSuccess = success })
    setGeolocation({ getCurrentPosition } as unknown as Geolocation)
    let resolveReverse: ((response: ReturnType<typeof json>) => void) | undefined
    const reverseResponse = new Promise<ReturnType<typeof json>>((resolve) => { resolveReverse = resolve })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('/api/location/search')) return json({ candidates: [{ name: '名古屋駅', area: '名古屋市', lat: 35.17, lng: 136.88 }] })
      if (String(input).startsWith('/api/location/reverse')) return reverseResponse
      return json({ error: 'unexpected' }, false)
    })
    vi.stubGlobal('fetch', fetchMock)
    renderRoute('/')
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1))
    onSuccess?.(position(35, 136))
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith('/api/location/reverse'))).toBe(true))
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /現在地周辺/ }))
    await user.type(screen.getByRole('searchbox', { name: '駅名・地名を検索' }), '名古屋')
    await user.click(await screen.findByRole('button', { name: /名古屋駅/ }))
    resolveReverse?.(json({ name: '古い現在地' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /名古屋駅/ })).toBeTruthy())
    await Promise.resolve()
    expect(screen.queryByText('古い現在地')).toBeNull()
  })

  it.each([
    ['拒否', 1, '現在地を取得できませんでした。駅名・地名から選べます。'],
    ['タイムアウト', 3, '現在地を取得できませんでした。駅名・地名から選べます。'],
  ])('現在地取得が%sなら駅名入力を開く', async (_name, code, message) => {
    let onError: PositionErrorCallback | undefined
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => { onError = error })
    setGeolocation({ getCurrentPosition } as unknown as Geolocation)
    renderRoute('/')
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1))
    onError?.({ code } as GeolocationPositionError)
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain(message))
    expect(screen.getByRole('searchbox', { name: '駅名・地名を検索' })).toBeTruthy()
  })

  it('現在地に対応していないブラウザでは駅名入力を開く', async () => {
    setGeolocation(undefined)
    renderRoute('/')
    expect((await screen.findByRole('status')).textContent).toContain('このブラウザでは現在地を取得できません。駅名・地名から選べます。')
    expect(screen.getByRole('searchbox', { name: '駅名・地名を検索' })).toBeTruthy()
  })

  it('StrictModeでも現在地は一度だけ要求され、成功結果を反映する', async () => {
    let onSuccess: PositionCallback | undefined
    const getCurrentPosition = vi.fn((success: PositionCallback) => { onSuccess = success })
    setGeolocation({ getCurrentPosition } as unknown as Geolocation)
    renderRoute('/', true)
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1))
    onSuccess?.(position(35.17, 136.88))
    await waitFor(() => expect(screen.getByRole('button', { name: /現在地周辺/ })).toBeTruthy())
  })

  it('モード・カテゴリを変えても現在地を再要求しない', async () => {
    const getCurrentPosition = vi.fn()
    setGeolocation({ getCurrentPosition } as unknown as Geolocation)
    renderRoute('/')
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '暇つぶしから探す' }))
    await user.click(screen.getByRole('button', { name: 'カフェ' }))
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('アンマウント時に進行中の逆ジオコードを中止し、完了結果を無視する', async () => {
    let onSuccess: PositionCallback | undefined
    const getCurrentPosition = vi.fn((success: PositionCallback) => { onSuccess = success })
    setGeolocation({ getCurrentPosition } as unknown as Geolocation)
    let reverseSignal: AbortSignal | undefined
    let resolveReverse: ((response: ReturnType<typeof json>) => void) | undefined
    const reverseResponse = new Promise<ReturnType<typeof json>>((resolve) => { resolveReverse = resolve })
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith('/api/location/reverse')) {
        reverseSignal = init?.signal as AbortSignal | undefined
        return reverseResponse
      }
      return Promise.resolve(json({ error: 'unexpected' }, false))
    })
    vi.stubGlobal('fetch', fetchMock)
    renderRoute('/')
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1))
    onSuccess?.(position(35.17, 136.88))
    await waitFor(() => expect(reverseSignal).toBeDefined())
    cleanup()
    expect(reverseSignal?.aborted).toBe(true)
    resolveReverse?.(json({ name: 'アンマウント後の現在地' }))
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('お気に入りではGoogleの施設タイプを日本語カテゴリで表示する', async () => {
    window.localStorage.setItem('imahima:favorites:v1', JSON.stringify({
      version: 1,
      favorites: [{ placeId: 'fitness-place', addedAt: 1 }],
    }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'imahima:favorites:v1', storageArea: window.localStorage }))
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/places/fitness-place') {
        return json({
          id: 'fitness-place', name: '確認ジム', category: 'fitness_center',
          location: { lat: 35.17, lng: 136.88 }, rating: null, openNow: null, photos: [], address: null,
        })
      }
      return json({ error: 'not found' }, false)
    }))

    renderRoute('/favorites')
    expect(await screen.findByRole('heading', { level: 3, name: '確認ジム' })).toBeTruthy()
    expect(screen.getByText('運動')).toBeTruthy()
    expect(screen.queryByText('fitness_center')).toBeNull()

    window.localStorage.removeItem('imahima:favorites:v1')
    window.dispatchEvent(new StorageEvent('storage', { key: 'imahima:favorites:v1', storageArea: window.localStorage }))
  })
})
