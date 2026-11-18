// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DetailInfoCards } from './DetailInfoCards'

afterEach(cleanup)

it('曜日別営業時間と予算を表示する', () => {
  render(<DetailInfoCards
    openingHours={['月曜日: 9:00～18:00', '火曜日: 9:00～18:00']}
    budget="￥1,000〜￥2,000"
  />)

  expect(screen.getByText('月曜日: 9:00～18:00')).toBeTruthy()
  expect(screen.getByText('火曜日: 9:00～18:00')).toBeTruthy()
  expect(screen.getByText('￥1,000〜￥2,000')).toBeTruthy()
})

it('営業時間と予算がなければ案内文を表示する', () => {
  render(<DetailInfoCards />)

  expect(screen.getAllByText('情報がありません')).toHaveLength(2)
})
