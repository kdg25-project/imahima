import type { CSSProperties } from 'react'
import { Chip } from '../ui/Chip'

export function DetailSummary({ name, tags = [], rating, reviewCount, description }: {
  name: string
  tags?: { label: string; tone?: 'neutral' | 'positive' }[]
  rating?: string
  reviewCount?: number
  description?: string
}) {
  const numericRating = rating === undefined ? undefined : Number(rating)
  const ratingPercent = typeof numericRating === 'number' && Number.isFinite(numericRating) ? Math.min(100, Math.max(0, (numericRating / 5) * 100)) : undefined
  return <div className="detail-summary">
    {tags.length > 0 && <div className="cluster">{tags.map(tag => <Chip key={tag.label} compact tone={tag.tone}>{tag.tone === 'positive' && <i className="detail-status-dot" />} {tag.label}</Chip>)}</div>}
    <h1>{name}</h1>
    {description && <p className="detail-description">{description}</p>}
    {ratingPercent !== undefined && <div className="detail-rating" aria-label={`評価 ${rating}${reviewCount !== undefined ? `、口コミ${reviewCount}件` : ''}`}><span className="detail-stars" aria-hidden="true" style={{ '--rating-percent': `${ratingPercent}%` } as CSSProperties}>★★★★★</span><span aria-hidden="true">{rating}{reviewCount !== undefined ? ` (${reviewCount})` : ''}</span></div>}
  </div>
}
