// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

type ClickListener = (event: { feature: { getProperty(name: string): unknown } }) => void

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  let reject: (reason?: unknown) => void = () => undefined
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function installGoogleMapsMock() {
  const addGeoJson = vi.fn(() => [{ getProperty: (name: string) => name === 'placeId' ? 'cafe-1' : undefined }])
  const remove = vi.fn()
  const setStyle = vi.fn()
  let clickListener: ClickListener | undefined
  const listener = { remove: vi.fn() }
  const addListener = vi.fn((_event: string, callback: ClickListener) => {
    clickListener = callback
    return listener
  })
  const extend = vi.fn()
  const fitBounds = vi.fn()
  const Map = vi.fn(function () {
    return { data: { addGeoJson, remove, setStyle, addListener }, fitBounds }
  })
  const LatLngBounds = vi.fn(function () { return { extend } })
  const importLibrary = vi.fn((name: string) => {
    if (name === 'maps') return Promise.resolve({ Map })
    if (name === 'core') return Promise.resolve({ LatLngBounds })
    return Promise.reject(new Error(`Unexpected library: ${name}`))
  })
  Object.assign(window, { google: { maps: { importLibrary } } })
  return {
    addGeoJson, remove, setStyle, listener, extend, fitBounds, Map, importLibrary,
    click(placeId = 'cafe-1') { clickListener?.({ feature: { getProperty: (name) => name === 'placeId' ? placeId : undefined } }) },
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  delete (window as Window & { google?: unknown }).google
  delete (window as Window & { __imahimaGoogleMapsLoaded?: unknown }).__imahimaGoogleMapsLoaded
  document.querySelectorAll('script[data-imahima-google-maps]').forEach((script) => script.remove())
})

describe('PlaceMap', () => {
  it('キーがなくても、地点一覧はキーボードで選択でき、Google Mapsへの安全なフォールバックを示す', async () => {
    const { PlaceMap } = await import('./PlaceMap')
    const onSelectPlace = vi.fn()
    render(<PlaceMap
      places={[{ id: 'cafe-1', name: '確認カフェ', location: { lat: 35.1, lng: 136.9 } }]}
      selectedPlaceId="cafe-1"
      onSelectPlace={onSelectPlace}
    />)

    expect(screen.getByRole('status').textContent).toContain('この環境では地図を表示できません。')
    const external = screen.getByRole('link', { name: 'Google マップで見る' })
    expect(external.getAttribute('href')).toContain('query=%E7%A2%BA%E8%AA%8D%E3%82%AB%E3%83%95%E3%82%A7')
    const button = screen.getByRole('button', { name: '確認カフェ' })
    button.focus()
    await userEvent.setup().keyboard('{Enter}')
    expect(onSelectPlace).toHaveBeenCalledWith('cafe-1')
  })

  it('詳細に有効な座標がない場合は地図リンクや架空の地点を作らない', async () => {
    const { PlaceMap } = await import('./PlaceMap')
    render(<PlaceMap place={{ name: '座標なしのスポット', location: null }} />)

    expect(screen.getByRole('status').textContent).toContain('この環境では地図を表示できません。')
    expect(screen.queryByRole('link', { name: 'Google マップで見る' })).toBeNull()
    expect(screen.queryByRole('list', { name: '地図上の地点一覧' })).toBeNull()
  })

  it('単一点ではズームを維持して、GeoJSONと最新のコールバックへ地点クリックを通知して片付ける', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'browser-test-key')
    const maps = installGoogleMapsMock()
    const { PlaceMap } = await import('./PlaceMap')
    const initial = vi.fn()
    const latest = vi.fn()
    const { rerender, unmount } = render(<PlaceMap
      origin={{ lat: 35, lng: 136 }}
      places={[{ id: 'cafe-1', name: '確認カフェ', location: { lat: 35.1, lng: 136.9 } }]}
      selectedPlaceId="cafe-1"
      onSelectPlace={initial}
    />)

    await waitFor(() => expect(screen.getByText('地図データ © Google')).toBeTruthy())
    expect(maps.importLibrary).toHaveBeenCalledWith('maps')
    expect(maps.importLibrary).toHaveBeenCalledWith('core')
    expect(maps.addGeoJson).toHaveBeenCalledWith(expect.objectContaining({
      features: [expect.objectContaining({ geometry: { type: 'Point', coordinates: [136.9, 35.1] } })],
    }))
    expect(maps.Map).toHaveBeenCalledWith(expect.any(HTMLElement), { center: { lat: 35.1, lng: 136.9 }, zoom: 15 })
    expect(maps.extend).not.toHaveBeenCalled()
    expect(maps.fitBounds).not.toHaveBeenCalled()

    rerender(<PlaceMap
      origin={{ lat: 35, lng: 136 }}
      places={[{ id: 'cafe-1', name: '確認カフェ', location: { lat: 35.1, lng: 136.9 } }]}
      selectedPlaceId="cafe-1"
      onSelectPlace={latest}
    />)
    maps.click()
    expect(initial).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledWith('cafe-1')

    unmount()
    expect(maps.listener.remove).toHaveBeenCalledTimes(1)
    expect(maps.remove).toHaveBeenCalledTimes(1)
  })

  it('複数地点ではすべての地点に合わせて表示範囲を調整する', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'browser-test-key')
    const maps = installGoogleMapsMock()
    const { PlaceMap } = await import('./PlaceMap')
    render(<PlaceMap
      places={[
        { id: 'cafe-1', name: '確認カフェ', location: { lat: 35.1, lng: 136.9 } },
        { id: 'cafe-2', name: '別のカフェ', location: { lat: 35.2, lng: 137 } },
      ]}
    />)

    await waitFor(() => expect(screen.getByText('地図データ © Google')).toBeTruthy())
    expect(maps.extend).toHaveBeenCalledWith({ lat: 35.1, lng: 136.9 })
    expect(maps.extend).toHaveBeenCalledWith({ lat: 35.2, lng: 137 })
    expect(maps.fitBounds).toHaveBeenCalledWith(expect.anything(), 32)
  })

  it('loading=async の直接読み込みでは load イベントでなく完了コールバックを待つ', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'browser-test-key')
    const { PlaceMap } = await import('./PlaceMap')
    render(<PlaceMap place={{ name: '確認カフェ', location: { lat: 35.1, lng: 136.9 } }} />)

    const script = document.querySelector<HTMLScriptElement>('script[data-imahima-google-maps]')
    expect(script?.src).toContain('loading=async')
    expect(script?.src).toContain('callback=__imahimaGoogleMapsLoaded')
    script?.dispatchEvent(new Event('load'))
    expect(screen.getByRole('status').textContent).toContain('地図を読み込んでいます…')

    const maps = installGoogleMapsMock()
    ;(window as Window & { __imahimaGoogleMapsLoaded?: () => void }).__imahimaGoogleMapsLoaded?.()
    await waitFor(() => expect(screen.getByText('地図データ © Google')).toBeTruthy())
    expect(maps.importLibrary).toHaveBeenCalledWith('maps')
    expect(maps.importLibrary).toHaveBeenCalledWith('core')
  })

  it('直接読み込みの失敗は地図のフォールバックに切り替える', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'browser-test-key')
    const { PlaceMap } = await import('./PlaceMap')
    render(<PlaceMap place={{ name: '確認カフェ', location: { lat: 35.1, lng: 136.9 } }} />)

    document.querySelector<HTMLScriptElement>('script[data-imahima-google-maps]')?.dispatchEvent(new Event('error'))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('地図を表示できませんでした。'))
  })

  it('SDKが地点の追加結果を返さない場合はフォールバックを表示し、画面遷移時にクラッシュしない', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'browser-test-key')
    const maps = installGoogleMapsMock()
    maps.addGeoJson.mockImplementationOnce(() => undefined as never)
    const { PlaceMap } = await import('./PlaceMap')
    const { unmount } = render(<PlaceMap place={{ name: '確認カフェ', location: { lat: 35.1, lng: 136.9 } }} />)

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('地図を表示できませんでした。'))
    expect(() => unmount()).not.toThrow()
    expect(maps.remove).not.toHaveBeenCalled()
  })

  it('SDKの失敗と、アンマウント後に解決するSDKを表示エラーや状態更新にしない', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'browser-test-key')
    const pending = deferred<unknown>()
    Object.assign(window, { google: { maps: { importLibrary: vi.fn(() => pending.promise) } } })
    const { PlaceMap } = await import('./PlaceMap')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { unmount } = render(<PlaceMap place={{ name: '確認カフェ', location: { lat: 35.1, lng: 136.9 } }} />)
    expect(screen.getByRole('status').textContent).toContain('地図を読み込んでいます…')
    unmount()
    await act(async () => { pending.resolve({}); await Promise.resolve() })
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()

    vi.resetModules()
    Object.assign(window, { google: { maps: { importLibrary: vi.fn(() => Promise.reject(new Error('SDK failed'))) } } })
    const { PlaceMap: RejectingPlaceMap } = await import('./PlaceMap')
    render(<RejectingPlaceMap place={{ name: '確認カフェ', location: { lat: 35.1, lng: 136.9 } }} />)
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('地図を表示できませんでした。'))
  })
})
