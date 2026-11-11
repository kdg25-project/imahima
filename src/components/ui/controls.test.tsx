// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Button } from './Button'
import { Chip, ChoiceChip } from './Chip'
import { IconButton } from './IconButton'

afterEach(cleanup)

describe('共通操作部品', () => {
  it('フォーム内で既定のボタンが意図せず送信せず、EnterとSpaceで操作できる', async () => {
    const onSubmit = vi.fn((event) => event.preventDefault())
    const onClick = vi.fn()
    render(<form onSubmit={onSubmit}><Button onClick={onClick}>実行</Button><Button disabled onClick={onClick}>無効</Button></form>)
    const user = userEvent.setup()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '実行' }))
    await user.keyboard('{Enter} ')
    expect(onClick).toHaveBeenCalledTimes(2)
    expect(onSubmit).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '無効' }))
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('選択状態を画面側が制御でき、静的チップは操作対象にしない', async () => {
    function Example() {
      const [selected, setSelected] = useState(false)
      return <><Chip>屋内</Chip><ChoiceChip selected={selected} onClick={() => setSelected(!selected)}>カフェ</ChoiceChip></>
    }
    render(<Example />)
    const user = userEvent.setup()
    const choice = screen.getByRole('button', { name: 'カフェ' })
    await user.tab()
    expect(document.activeElement).toBe(choice)
    await user.keyboard(' ')
    expect(choice.getAttribute('aria-pressed')).toBe('true')
    await user.keyboard('{Enter}')
    expect(choice.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('アイコンだけの操作にも読み上げ用の名前を付ける', () => {
    render(<IconButton label="閉じる" icon="×" />)
    expect(screen.getByRole('button', { name: '閉じる' })).toBeTruthy()
  })
})

describe('時間選択の表示部品', () => {
  it('選択位置を変更すると読み上げ用の時間ラベルも更新する', async () => {
    const { TimeRange } = await import('./TimeRange')
    function Example() {
      const [value, setValue] = useState(1)
      return <TimeRange labels={['30分', '1時間', '2時間']} value={value} onChange={setValue} />
    }
    render(<Example />)
    const range = screen.getByRole('slider', { name: '空き時間' })
    fireEvent.change(range, { target: { value: '2' } })
    expect((range as HTMLInputElement).value).toBe('2')
    expect(range.getAttribute('aria-valuetext')).toBe('2時間')
  })
})
