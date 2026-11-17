import { useState } from 'react'
import type { PlacePhoto as PlacePhotoDTO } from '../../lib/api'
import './PlacePhoto.css'

type PlacePhotoProps = {
  photo?: PlacePhotoDTO
  alt: string
  className?: string
  width?: number
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

export function PlacePhoto({ photo, alt, className, width }: PlacePhotoProps) {
  const [failedUrl, setFailedUrl] = useState<string | undefined>()
  const imageUrl = (() => {
    if (!photo?.name) return undefined
    const params = new URLSearchParams({ name: photo.name, maxWidthPx: String(photoWidth(width)) })
    return `/api/place-photos?${params}`
  })()
  const failed = imageUrl === failedUrl

  const attributions = photo?.authorAttributions ?? []
  const classes = ['place-photo', className].filter(Boolean).join(' ')

  return (
    <figure className={classes}>
      {imageUrl && !failed ? (
        <img src={imageUrl} alt={alt} loading="lazy" onError={() => setFailedUrl(imageUrl)} />
      ) : (
        <div className="place-photo__fallback" role="img" aria-label={`${alt}（写真なし）`}>写真はありません</div>
      )}
      {attributions.length > 0 ? (
        <figcaption className="place-photo__attributions">
          {attributions.map((attribution, index) => {
            const name = attribution.displayName?.trim()
            const uri = safeAttributionUri(attribution.uri)
            if (!name && !uri) return null
            const label = name || '写真提供者'
            return uri ? <a href={uri} target="_blank" rel="noreferrer" key={`${uri}-${index}`}>{label}</a> : <span key={`${label}-${index}`}>{label}</span>
          })}
        </figcaption>
      ) : null}
    </figure>
  )
}
