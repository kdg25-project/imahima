import type { KeyboardEvent } from 'react'

export type DetailTab = 'map' | 'menu' | 'reviews' | 'facility'

export const detailTabs: { id: DetailTab; label: string }[] = [
  { id: 'map', label: '地図' },
  { id: 'menu', label: 'メニュー' },
  { id: 'reviews', label: '口コミ' },
  { id: 'facility', label: '施設情報' },
]

export function DetailTabs({ activeTab, onChange, reviewCount, idPrefix = 'detail' }: {
  activeTab: DetailTab
  onChange: (tab: DetailTab) => void
  reviewCount?: number
  idPrefix?: string
}) {
  const selectFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keyToIndex = {
      ArrowLeft: (index + detailTabs.length - 1) % detailTabs.length,
      ArrowRight: (index + 1) % detailTabs.length,
      Home: 0,
      End: detailTabs.length - 1,
    } as const
    if (!(event.key in keyToIndex)) return
    event.preventDefault()
    const next = detailTabs[keyToIndex[event.key as keyof typeof keyToIndex]]
    onChange(next.id)
    requestAnimationFrame(() => document.getElementById(`${idPrefix}-tab-${next.id}`)?.focus())
  }

  return <div className="detail-tabs" role="tablist" aria-label="スポット詳細">
    {detailTabs.map((tab, index) => {
      const selected = activeTab === tab.id
      const label = tab.id === 'reviews' && reviewCount !== undefined ? `口コミ(${reviewCount})` : tab.label
      return <button key={tab.id} type="button" role="tab" id={`${idPrefix}-tab-${tab.id}`} tabIndex={selected ? 0 : -1} aria-selected={selected} aria-controls={`${idPrefix}-panel-${tab.id}`} onClick={() => onChange(tab.id)} onKeyDown={(event) => selectFromKeyboard(event, index)}>{label}</button>
    })}
  </div>
}
