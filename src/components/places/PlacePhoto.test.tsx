// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlacePhoto } from './PlacePhoto'

afterEach(cleanup)

describe('PlacePhoto', () => {
  it('安全な提供者表示と、Google写真名をエンコードした相対プロキシURLを使う', () => {
    render(<PlacePhoto
      alt="カフェの写真"
      width={9999}
      photo={{
        name: 'places/place 1/photos/photo?1',
        authorAttributions: [
          { displayName: '写真提供者', uri: 'https://example.com/credit' },
          { displayName: '危険な提供者', uri: 'javascript:alert(1)' },
        ],
      }}
    />)

    const image = screen.getByRole('img', { name: 'カフェの写真' }) as HTMLImageElement
    expect(image.getAttribute('loading')).toBe('lazy')
    expect(image.getAttribute('src')).toBe('/api/place-photos?name=places%2Fplace+1%2Fphotos%2Fphoto%3F1&maxWidthPx=4800')
    expect(screen.getByRole('link', { name: '写真提供者' }).getAttribute('href')).toBe('https://example.com/credit')
    expect(screen.queryByRole('link', { name: '危険な提供者' })).toBeNull()
    expect(screen.getByText('危険な提供者')).toBeTruthy()
  })

  it('写真の読み込み失敗を表示し、別の写真URLに変われば再試行できる', () => {
    const { rerender } = render(<PlacePhoto
      alt="カフェの写真"
      width={0}
      photo={{ name: 'places/a/photos/first', authorAttributions: [] }}
    />)

    const first = screen.getByRole('img', { name: 'カフェの写真' })
    expect(first.getAttribute('src')).toContain('maxWidthPx=1')
    fireEvent.error(first)
    expect(screen.getByRole('img', { name: 'カフェの写真（写真なし）' })).toBeTruthy()

    rerender(<PlacePhoto
      alt="カフェの写真"
      photo={{ name: 'places/a/photos/second', authorAttributions: [] }}
    />)
    expect(screen.getByRole('img', { name: 'カフェの写真' }).getAttribute('src')).toContain('places%2Fa%2Fphotos%2Fsecond')
  })
})
