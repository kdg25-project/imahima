// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FavoriteButton, FavoritesStore, parseFavoriteRecords, useFavorites } from './favorites'

afterEach(cleanup)

function FavoritesProbe() {
  const { favorites, storageAvailable } = useFavorites()
  return <output data-testid="favorites-probe">{`${favorites.map((favorite) => favorite.placeId).join(',')}:${storageAvailable}`}</output>
}

describe('お気に入りストア', () => {
  it('壊れた保存値を空として扱い、Googleの場所情報を読み込まない', () => {
    expect(parseFavoriteRecords('{not-json')).toEqual([])
    expect(parseFavoriteRecords(JSON.stringify([{ placeId: 'place-1', addedAt: 1 }]))).toEqual([])
    expect(parseFavoriteRecords(JSON.stringify({ version: 0, favorites: [] }))).toEqual([])
    expect(parseFavoriteRecords(JSON.stringify({ version: 1, favorites: [
      { placeId: 'place-1', addedAt: 1, name: '保存してはいけない名称' },
      { placeId: 'place-1', addedAt: 2 },
      { placeId: '', addedAt: 3 },
    ] }))).toEqual([{ placeId: 'place-1', addedAt: 1 }])
  })

  it('同じPlace IDを重複保存せず、追加と削除を永続化する', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const store = new FavoritesStore(storage, () => 42)

    act(() => store.add('place-1'))
    act(() => store.add('place-1'))
    expect(store.getSnapshot().favorites).toEqual([{ placeId: 'place-1', addedAt: 42 }])
    expect(values.get('imahima:favorites:v1')).toBe(JSON.stringify({ version: 1, favorites: [{ placeId: 'place-1', addedAt: 42 }] }))

    act(() => store.remove('place-1'))
    expect(store.getSnapshot().favorites).toEqual([])
  })

  it('ストレージ書き込みが拒否されても、現在のタブでの状態と警告を保つ', () => {
    const store = new FavoritesStore({
      getItem: () => null,
      setItem: () => { throw new Error('blocked') },
    }, () => 42)

    act(() => store.add('place-1'))
    expect(store.getSnapshot()).toEqual({ favorites: [{ placeId: 'place-1', addedAt: 42 }], storageAvailable: false })
  })

  it('保存状態をボタンの押下とaria状態へ反映する', async () => {
    window.localStorage.removeItem('imahima:favorites:v1')
    render(<><FavoriteButton placeId="place-2" /><FavoritesProbe /></>)
    const button = screen.getByRole('button', { name: 'お気に入りに追加' })
    await act(async () => button.click())
    expect(screen.getByRole('button', { name: 'お気に入りから削除' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('favorites-probe').textContent).toBe('place-2:true')
  })
})
