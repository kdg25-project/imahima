import { useState } from 'react'
import type { PlacePhoto as PlacePhotoDTO } from '../../lib/api'
import './PlacePhoto.css'

type PlacePhotoProps = {
  photo?: PlacePhotoDTO
  alt: string
  className?: string
  width?: number
  attributions?: 'visible' | 'hidden'
  showAttributionAvatars?: boolean
  as?: 'figure' | 'span'
}

function safeAttributionUri(value: string | undefined) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
  } catch {
    return undefined
  }
}

function photoWidth(value: number | undefined) {
  if (!Number.isFinite(value)) return 800
  return Math.min(4800, Math.max(1, Math.round(value ?? 800)))
}

export function PlacePhoto({ photo, alt, className, width, attributions: attributionVisibility = 'visible', showAttributionAvatars = false, as = 'figure' }: PlacePhotoProps) {
  const [failedUrl, setFailedUrl] = useState<string | undefined>()
  const imageUrl = (() => {
    if (!photo?.name) return undefined
    const params = new URLSearchParams({ name: photo.name, maxWidthPx: String(photoWidth(width)) })
    return `/api/place-photos?${params}`
  })()
  const failed = imageUrl === failedUrl

  const attributions = photo?.authorAttributions ?? []
  const classes = ['place-photo', className].filter(Boolean).join(' ')

  function renderAttributions() {
    return attributions.map((attribution, index) => {
      const name = attribution.displayName?.trim()
      const uri = safeAttributionUri(attribution.uri)
      const photoUri = safeAttributionUri(attribution.photoUri)
      if (!name && !uri) return null
      const label = name || '写真提供者'
      const content = <>{showAttributionAvatars && photoUri ? <img className="place-photo__avatar" src={photoUri} alt="" /> : null}{label}</>
      return uri ? <a href={uri} target="_blank" rel="noreferrer" key={`${uri}-${index}`}>{content}</a> : <span key={`${label}-${index}`}>{content}</span>
    })
  }
  const attributionContent = attributionVisibility === 'visible' && attributions.length > 0
    ? as === 'figure' ? <figcaption className="place-photo__attributions">{renderAttributions()}</figcaption> : <span className="place-photo__attributions">{renderAttributions()}</span>
    : null
  const content = <>
      {imageUrl && !failed ? (
        <img src={imageUrl} alt={alt} loading="lazy" onError={() => setFailedUrl(imageUrl)} />
      ) : (
        <div className="place-photo__fallback" role="img" aria-label={`${alt}（写真なし）`}>写真はありません</div>
      )}
      {attributionContent}
    </>
  return as === 'figure' ? <figure className={classes}>{content}</figure> : <span className={classes}>{content}</span>
}
