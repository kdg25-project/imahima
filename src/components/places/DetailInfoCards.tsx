import { Icon } from '../ui/Icon'

export function DetailInfoCards({ openingHours, budget }: {
  openingHours?: string[] | null
  budget?: string | null
}) {
  const hours = openingHours?.filter((description) => description.trim() !== '') ?? []
  return <div className="detail-info-cards" aria-label="基本情報">
    <div className="detail-info-card detail-info-card--hours"><span className="detail-info-card__icon"><Icon name="clockDetail" /></span><span className="detail-info-card__label">営業時間</span><strong>{hours.length > 0 ? <span className="detail-info-card__hours">{hours.map((description, index) => <span key={`${description}-${index}`}>{description}</span>)}</span> : '情報がありません'}</strong></div>
    <div className="detail-info-card"><span className="detail-info-card__icon detail-info-card__currency" aria-hidden="true">¥</span><span className="detail-info-card__label">予算</span><strong>{budget || '情報がありません'}</strong></div>
  </div>
}
