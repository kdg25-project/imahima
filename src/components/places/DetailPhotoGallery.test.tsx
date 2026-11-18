// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DetailPhotoGallery } from './DetailPhotoGallery'

afterEach(cleanup)

const photos = [
  { name: 'places/a/photos/one', authorAttributions: [{ displayName: '撮影者 1', uri: 'https://example.com/one', photoUri: 'https://example.com/avatar-one' }] },
  { name: 'places/a/photos/two', authorAttributions: [{ displayName: '撮影者 2', uri: 'https://example.com/two' }] },
  { name: 'places/a/photos/three', authorAttributions: [{ displayName: '撮影者 3', uri: 'https://example.com/three' }] },
  { name: 'places/a/photos/four', authorAttributions: [{ displayName: '撮影者 4', uri: 'https://example.com/four' }] },
]

describe('DetailPhotoGallery', () => {
  it('一覧では撮影者名を隠し、拡大表示でプロフィール付きのクレジットを表示する', async () => {
    const user = userEvent.setup()
    render(<DetailPhotoGallery photos={photos} placeName="カフェ" />)

    expect(screen.queryByText('撮影者 1')).toBeNull()
    const thumbnail = screen.getByRole('button', { name: 'カフェの写真 1を拡大' })
    await user.click(thumbnail)

    expect(screen.getByRole('dialog', { name: 'カフェの写真 1' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '撮影者 1' }).getAttribute('href')).toBe('https://example.com/one')
    expect(screen.getByRole('presentation').getAttribute('src')).toBe('https://example.com/avatar-one')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(thumbnail)
  })

  it('写真の続きは +N のサムネイルから開いて切り替えられる', async () => {
    const user = userEvent.setup()
    render(<DetailPhotoGallery photos={photos} placeName="カフェ" />)

    await user.click(screen.getByRole('button', { name: 'カフェの写真 3を拡大' }))
    expect(screen.getByText('3 / 4')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '次の写真' }))
    expect(screen.getByRole('dialog', { name: 'カフェの写真 4' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '撮影者 4' })).toBeTruthy()
  })
})
