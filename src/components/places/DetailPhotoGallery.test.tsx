// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { DetailPhotoGallery, DetailPhotoHero, DetailPhotoViewer } from './DetailPhotoGallery'

afterEach(cleanup)

const photos = [
  { name: 'places/a/photos/one', authorAttributions: [{ displayName: '撮影者 1', uri: 'https://example.com/one', photoUri: 'https://example.com/avatar-one' }] },
  { name: 'places/a/photos/two', authorAttributions: [{ displayName: '撮影者 2', uri: 'https://example.com/two' }] },
  { name: 'places/a/photos/three', authorAttributions: [{ displayName: '撮影者 3', uri: 'https://example.com/three' }] },
  { name: 'places/a/photos/four', authorAttributions: [{ displayName: '撮影者 4', uri: 'https://example.com/four' }] },
]

function PhotoHeroFixture() {
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null)
  return <>
    <DetailPhotoHero photo={photos[0]} placeName="カフェ" onOpen={setOpener} />
    {opener && <DetailPhotoViewer photos={photos} placeName="カフェ" opener={opener} onClose={() => setOpener(null)} />}
  </>
}

describe('DetailPhotoGallery', () => {
  it('一覧では撮影者名を隠し、写真一覧でプロフィール付きのクレジットを表示する', async () => {
    const user = userEvent.setup()
    render(<DetailPhotoGallery photos={photos} placeName="カフェ" />)

    expect(screen.queryByText('撮影者 1')).toBeNull()
    const thumbnail = screen.getByRole('button', { name: 'カフェの写真 1から一覧を開く' })
    await user.click(thumbnail)

    expect(screen.getByRole('dialog', { name: 'カフェの写真一覧' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '撮影者 1' }).getAttribute('href')).toBe('https://example.com/one')
    expect(screen.getByRole('presentation').getAttribute('src')).toBe('https://example.com/avatar-one')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(thumbnail)
  })

  it('写真の続きは +N のサムネイルから開いた一覧で確認できる', async () => {
    const user = userEvent.setup()
    render(<DetailPhotoGallery photos={photos} placeName="カフェ" />)

    await user.click(screen.getByRole('button', { name: 'カフェの写真 3から一覧を開く' }))
    expect(screen.getByText('+1')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'カフェの写真一覧' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '撮影者 4' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '次の写真' })).toBeNull()
  })

  it('詳細のメイン写真はクレジットを保ったまま一覧を開ける', async () => {
    const user = userEvent.setup()
    render(<PhotoHeroFixture />)

    const heroButton = screen.getByRole('button', { name: 'カフェの写真一覧を開く' })
    const credit = screen.getByRole('link', { name: '撮影者 1' })
    expect(heroButton.contains(credit)).toBe(false)

    await user.click(credit)
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(heroButton)
    expect(screen.getByRole('dialog', { name: 'カフェの写真一覧' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '撮影者 4' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '写真一覧を閉じる' }))
    expect(document.activeElement).toBe(heroButton)
  })
})
