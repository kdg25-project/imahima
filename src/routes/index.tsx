import { createFileRoute, Link } from '@tanstack/react-router'
import { lazy, Suspense, useState } from 'react'
import { buttonClassName, ButtonArrow } from '../components/ui/Button'
import { CategoryGlyph, Icon } from '../components/ui/Icon'
import { ChoiceChip } from '../components/ui/Chip'
import { TimeRange } from '../components/ui/TimeRange'
import { LoadingState } from '../components/feedback/States'

const UiPreview = import.meta.env.DEV ? lazy(() => import('../components/dev/UiPreview').then(module => ({ default: module.UiPreview }))) : null

export const Route = createFileRoute('/')({ component: Home })
const categoryLabels = ['すべて', 'カフェ', 'ごはん', '買い物', '遊び', '観光', '運動', '自然', 'その他']
const timeLabels = ['~15分', '30分', '1時間', '2時間', '3時間~']

function Home() {
  const [mode, setMode] = useState<'nearby' | 'free-time'>('nearby')
  const [category, setCategory] = useState('すべて')
  const [timePosition, setTimePosition] = useState(2)
  const { preview } = Route.useSearch()
  if (preview === 'states' && UiPreview) return <Suspense fallback={<LoadingState />}><UiPreview /></Suspense>
  return (
    <div className="home-screen">
      <h1 className="brand">いまひま？</h1>
      <div className="home-form">
        <div className="home-modes" role="group" aria-label="検索モード">
          <button type="button" aria-pressed={mode === 'nearby'} onClick={() => setMode('nearby')}>近くから探す</button>
          <button type="button" aria-pressed={mode === 'free-time'} onClick={() => setMode('free-time')}>暇つぶしから探す</button>
        </div>
        <fieldset className="choice-group area-field">
          <legend><Icon name="pin" />エリア</legend>
          <div className="field-inset area-control"><Icon name="map" /><select aria-label="エリア"><option>現在地周辺</option></select><Icon name="down" /></div>
        </fieldset>
        <fieldset className="choice-group category-field">
          <legend><CategoryGlyph />カテゴリ</legend>
          <div className="field-inset category-grid">{categoryLabels.map(label => <ChoiceChip key={label} selected={category === label} onClick={() => setCategory(label)} icon={<CategoryGlyph />}>{label}</ChoiceChip>)}</div>
        </fieldset>
        {mode === 'free-time' && <fieldset className="choice-group time-field">
          <legend><Icon name="clock" />空き時間</legend>
          <TimeRange labels={timeLabels} value={timePosition} onChange={setTimePosition} />
        </fieldset>}
        <Link className={`${buttonClassName()} button--arrow home-search`} to="/search" search={import.meta.env.DEV ? { preview: 'design' } : {}}><span>この条件で探す</span><ButtonArrow /></Link>
      </div>
    </div>
  )
}
