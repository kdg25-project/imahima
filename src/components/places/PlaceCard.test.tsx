// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PlaceCard } from './PlaceCard'
import { DetailSummary } from './DetailSummary'

afterEach(cleanup)

it('カードの任意情報がなくても、料金・時間・写真を補完しない', () => {
  render(<PlaceCard place={{ name: '情報が少ないスポット' }} />)
  expect(screen.getByRole('heading', { name: '情報が少ないスポット' })).toBeTruthy()
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.queryByText(/徒歩|¥|営業中/)).toBeNull()
})

it('詳細の評価や営業状態が未提供なら表示しない', () => {
  render(<DetailSummary name="スポット名" />)
  expect(screen.getByRole('heading', { level: 1, name: 'スポット名' })).toBeTruthy()
  expect(screen.queryByText(/営業中|3.7|¥/)).toBeNull()
})
