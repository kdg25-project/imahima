import { Chip } from '../ui/Chip'
import { Icon } from '../ui/Icon'

export function DetailSummary({ name, tags = [], rating, reviewCount, price }: {
  name: string
  tags?: { label: string; tone?: 'neutral' | 'positive' }[]
  rating?: string
  reviewCount?: number
  price?: string
}) {
  return <div className="detail-summary">
    {tags.length > 0 && <div className="cluster">{tags.map(tag => <Chip key={tag.label} compact tone={tag.tone}>{tag.label}</Chip>)}</div>}
    <h1>{name}</h1>
    {(rating || price) && <div className="detail-rating">{rating && <><Icon name="star" /><span>{rating}{reviewCount !== undefined ? ` (${reviewCount})` : ''}</span></>}{price && <Chip>{price}</Chip>}</div>}
  </div>
}
