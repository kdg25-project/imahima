import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ResultsLayout } from '../places/ResultsLayout'
import { DetailRow, DetailsLayout } from '../places/DetailsLayout'
import { DetailInfoCards } from '../places/DetailInfoCards'
import { PlaceCard, PlaceRow } from '../places/PlaceCard'
import { Button, ButtonArrow, buttonClassName } from '../ui/Button'
import { DetailSummary } from '../places/DetailSummary'
import { DetailTabs, type DetailTab } from '../places/DetailTabs'
import { Icon } from '../ui/Icon'
import back from '../../assets/icons/back.svg'
import resultsMap from './assets/results-map.png'
import detailMap from './assets/detail-map.png'
import store from './assets/store.png'
import drinks from './assets/drinks.png'
import coffee from './assets/coffee.png'
import food from './assets/food.png'
import './DesignPreview.css'

// Entire module (including static map references and sample business data) is dev-only.
// These are Figma visual fixtures, never API results or an operational map.
const recommended = { name: 'スターバックス JRゲートタワー店', photos: [store, drinks, coffee], photoCount: 7, category: 'カフェ', price: '~¥1,000', distanceLabel: '徒歩5分(320m)', durationLabel: '15分〜1時間' }
const previewSearch = { preview: 'design' as const, mode: 'free-time' as const, category: 'すべて', freeTime: 60, area: '現在地周辺' }
const detailLink = <Link className={`${buttonClassName('primary', 'small')} button--arrow`} to="/places/$placeId" params={{ placeId: 'preview' }} search={previewSearch}><span>詳しく見る</span><ButtonArrow size="small" /></Link>

export function ResultsPreview() {
  return <div className="design-preview"><ResultsLayout summary="現在地周辺・1時間・すべて" changeAction={<Link className={buttonClassName('secondary', 'small')} to="/"><Icon name="filters" />条件を変更</Link>} map={<img className="design-map" src={resultsMap} alt="Figma表示確認用の静止地図。操作できません。" />}>
    <h2>おすすめスポット</h2><PlaceCard place={recommended} action={detailLink} />
    <h2 className="other-heading">他の候補</h2>
    <div className="place-list">{['45分〜2時間', '45分〜90分'].map(durationLabel => <PlaceRow key={durationLabel} place={{ name: '8thおいすたーばー', photos: [food], distanceLabel: '徒歩5分(320m)', durationLabel }} action={<Link className="row-link" aria-label="8thおいすたーばーの詳細" to="/places/$placeId" params={{ placeId: 'preview' }} search={previewSearch}><Icon name="chevron" /></Link>} />)}</div>
  </ResultsLayout></div>
}

export function DetailsPreview() {
  const [activeTab, setActiveTab] = useState<DetailTab>('map')
  return <div className="design-preview"><DetailsLayout backAction={<Link className="back-link" to="/search" search={{ preview: 'design', mode: 'free-time', category: 'すべて', walkMinutes: undefined, freeTime: 60, lat: undefined, lng: undefined, name: undefined, area: '現在地周辺' }} aria-label="検索結果へ戻る"><img src={back} alt="" /></Link>} hero={<img className="detail-preview-hero" src={store} alt="スターバックスの店内" />}>
    <DetailSummary name={'スターバックス\nJRゲートタワー店'} description="名古屋駅直結のスターバックス。仕事や待ち合わせにも。" tags={[{ label: 'カフェ' }, { label: '屋内' }, { label: '営業中', tone: 'positive' }]} rating="3.7" reviewCount={500} />
    <div className="detail-gallery" aria-label="スターバックスの写真"><div className="detail-gallery__card"><img src={store} alt="スターバックスの店内" /></div><div className="detail-gallery__card"><img src={drinks} alt="ドリンク" /></div><div className="detail-gallery__card"><img src={coffee} alt="コーヒー" /><span className="detail-gallery__more">+4</span></div></div>
    <div className="detail-walking"><DetailRow icon="walk">現在地から320m（徒歩5分）</DetailRow></div>
    <DetailInfoCards openingHours="7:00~22:00" budget="¥300~¥1,000" />
    <DetailTabs activeTab={activeTab} onChange={setActiveTab} reviewCount={503} idPrefix="preview-detail" />
    <div className="detail-tab-panel" id={`preview-detail-panel-${activeTab}`} role="tabpanel" aria-labelledby={`preview-detail-tab-${activeTab}`}>{activeTab === 'map' ? <div className="detail-map-wrap"><div className="detail-map"><img src={detailMap} alt="Figma表示確認用の静止地図。操作できません。" /></div><span className="detail-map-expand">地図を広げる</span></div> : <p className="detail-empty">このプレビューでは情報を表示していません。</p>}</div>
    <Button className="route-button" disabled><Icon name="direction" />経路を検索</Button>
  </DetailsLayout></div>
}
