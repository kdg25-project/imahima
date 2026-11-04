import { Link } from '@tanstack/react-router'
import { ResultsLayout } from '../places/ResultsLayout'
import { DetailRow, DetailsLayout } from '../places/DetailsLayout'
import { PlaceCard, PlaceRow } from '../places/PlaceCard'
import { Button, ButtonArrow, buttonClassName } from '../ui/Button'
import { DetailSummary } from '../places/DetailSummary'
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
const detailLink = <Link className={`${buttonClassName('primary', 'small')} button--arrow`} to="/places/$placeId" params={{ placeId: 'preview' }} search={{ preview: 'design' }}><span>詳しく見る</span><ButtonArrow size="small" /></Link>

export function ResultsPreview() {
  return <div className="design-preview"><ResultsLayout summary="現在地周辺・1時間・すべて" changeAction={<Link className={buttonClassName('secondary', 'small')} to="/"><Icon name="filters" />条件を変更</Link>} map={<img className="design-map" src={resultsMap} alt="Figma表示確認用の静止地図。操作できません。" />}>
    <h2>おすすめスポット</h2><PlaceCard place={recommended} action={detailLink} />
    <h2 className="other-heading">他の候補</h2>
    <div className="place-list">{['45分〜2時間', '45分〜90分'].map(durationLabel => <PlaceRow key={durationLabel} place={{ name: '8thおいすたーばー', photos: [food], distanceLabel: '徒歩5分(320m)', durationLabel }} action={<Link className="row-link" aria-label="8thおいすたーばーの詳細" to="/places/$placeId" params={{ placeId: 'preview' }} search={{ preview: 'design' }}><Icon name="chevron" /></Link>} />)}</div>
  </ResultsLayout></div>
}

export function DetailsPreview() {
  return <div className="design-preview"><DetailsLayout backAction={<Link className="back-link" to="/search" search={{ preview: 'design' }} aria-label="検索結果へ戻る"><img src={back} alt="" /></Link>} hero={<div className="hero-placeholder">写真の表示領域</div>}>
    <DetailSummary name="スターバックス" tags={[{ label: 'カフェ' }, { label: '屋内' }, { label: '営業中', tone: 'positive' }]} rating="3.7" reviewCount={503} price="~¥1,000" />
    <div className="detail-info"><DetailRow icon="walk">現在地から320m (徒歩5分)</DetailRow><DetailRow icon="clockDetail" supplement="あと13時間営業">7:00~22:00</DetailRow><DetailRow icon="pinDetail">住所が入ります</DetailRow><DetailRow icon="phone">電話番号が入ります</DetailRow></div>
    <div className="detail-map"><img src={detailMap} alt="Figma表示確認用の静止地図。操作できません。" /><Button variant="secondary" size="small" disabled>地図を広げる</Button></div>
    <Button className="route-button" disabled><Icon name="direction" />経路を検索</Button>
  </DetailsLayout></div>
}
