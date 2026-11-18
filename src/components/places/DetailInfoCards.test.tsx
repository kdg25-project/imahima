// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DetailInfoCards } from './DetailInfoCards'

afterEach(cleanup)

it('本日の営業時間と予算を表示する', () => {
  render(<DetailInfoCards
    todayOpeningHours="9:00～18:00"
    budget="￥1,000〜￥2,000"
  />)

  expect(screen.getByText('本日の営業時間')).toBeTruthy()
  expect(screen.getByText('9:00～18:00')).toBeTruthy()
  expect(screen.getByText('￥1,000〜￥2,000')).toBeTruthy()
})

it('営業時間と予算がなければ案内文を表示する', () => {
  render(<DetailInfoCards />)

  expect(screen.getAllByText('情報がありません')).toHaveLength(2)
})
