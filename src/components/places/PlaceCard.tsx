import type { ReactNode } from 'react'
import { Chip } from '../ui/Chip'
import { Icon } from '../ui/Icon'

// Presentation props, deliberately independent of the eventual API response schema.
export type PlaceCardData = {
  name: string
  photos?: string[]
  photoCount?: number
  category?: string
  price?: string
  distanceLabel?: string
  durationLabel?: string
}

export function PlaceMeta({ distanceLabel, durationLabel }: Pick<PlaceCardData, 'distanceLabel' | 'durationLabel'>) {
  return <div className="place-meta">{distanceLabel && <span><Icon name="pinSmall" />{distanceLabel}</span>}{durationLabel && <span><Icon name="clockSmall" />{durationLabel}</span>}</div>
}

export function PlaceCard({ place, action }: { place: PlaceCardData; action?: ReactNode }) {
  return <article className="place-card">
    {!!place.photos?.length && <div className="photo-strip">{place.photos.slice(0, 3).map((photo, index) => <div className="photo-strip__slot" key={`${photo}-${index}`}><img src={photo} alt={`${place.name}の写真 ${index + 1}`} />{index === 2 && place.photoCount && place.photoCount > 3 ? <span className="photo-strip__more">+{place.photoCount - 3}</span> : null}</div>)}</div>}
    <h3>{place.name}</h3><PlaceMeta {...place} />
    <div className="place-card__footer"><div className="cluster">{place.category && <Chip>{place.category}</Chip>}{place.price && <Chip>{place.price}</Chip>}</div>{action}</div>
  </article>
}

export function PlaceRow({ place, action }: { place: PlaceCardData; action?: ReactNode }) {
  return <article className="place-row">{place.photos?.[0] && <div className="place-row__photo"><img src={place.photos[0]} alt="" /></div>}<div className="place-row__text"><h3>{place.name}</h3><PlaceMeta {...place} /></div>{action}</article>
}
