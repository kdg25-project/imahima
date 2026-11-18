import { useEffect, useRef, useState } from 'react'
import type { PlacePhoto as PlacePhotoDTO } from '../../lib/api'
import { PlacePhoto } from './PlacePhoto'

type ImageSource = { src: string; alt: string }

type DetailPhotoGalleryProps = {
  photos: PlacePhotoDTO[]
  placeName: string
  imageSources?: ImageSource[]
  onOpen?: (trigger: HTMLButtonElement) => void
}

type DetailPhotoViewerProps = Pick<DetailPhotoGalleryProps, 'photos' | 'placeName' | 'imageSources'> & {
  opener: HTMLButtonElement
  onClose: () => void
}

type DetailPhotoHeroProps = {
  photo: PlacePhotoDTO
  placeName: string
  onOpen: (trigger: HTMLButtonElement) => void
}

function isImageSource(photo: PlacePhotoDTO | ImageSource): photo is ImageSource {
  return 'src' in photo
}

export function DetailPhotoHero({ photo, placeName, onOpen }: DetailPhotoHeroProps) {
  return <div className="detail-hero-photo-wrap">
    <PlacePhoto photo={photo} alt={`${placeName}の写真`} className="detail-hero-photo" width={1200} />
    <button className="detail-hero-photo-button" type="button" onClick={(event) => onOpen(event.currentTarget)} aria-label={`${placeName}の写真一覧を開く`} />
  </div>
}

export function DetailPhotoViewer({ photos, placeName, imageSources, opener, onClose }: DetailPhotoViewerProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const viewerRef = useRef<HTMLElement | null>(null)
  const galleryItems = imageSources ?? photos

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key === 'Tab') {
        const focusable = Array.from(viewerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [])
        if (focusable.length === 0) return
        const current = document.activeElement as HTMLElement | null
        const currentIndex = focusable.indexOf(current ?? focusable[0])
        const nextIndex = event.shiftKey
          ? (currentIndex + focusable.length - 1) % focusable.length
          : (currentIndex + 1) % focusable.length
        event.preventDefault()
        focusable[nextIndex]?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      opener.focus()
    }
  }, [onClose, opener])

  return <div className="detail-photo-viewer" role="dialog" aria-modal="true" aria-label={`${placeName}の写真一覧`}>
    <div className="detail-photo-viewer__backdrop" onClick={onClose} />
    <section className="detail-photo-viewer__content" ref={viewerRef}>
      <div className="detail-photo-viewer__header">
        <h2>{placeName}の写真</h2>
        <button ref={closeRef} className="detail-photo-viewer__close" type="button" onClick={onClose} aria-label="写真一覧を閉じる">×</button>
      </div>
      <div className="detail-photo-viewer__grid">
        {galleryItems.map((photo, index) => isImageSource(photo)
          ? <img className="detail-photo-viewer__grid-image" key={`${photo.src}-${index}`} src={photo.src} alt={photo.alt} />
          : <PlacePhoto key={photo.name ?? index} photo={photo} alt={`${placeName}の写真 ${index + 1}`} width={640} showAttributionAvatars />)}
      </div>
    </section>
  </div>
}

export function DetailPhotoGallery({ photos, placeName, imageSources, onOpen }: DetailPhotoGalleryProps) {
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null)
  const galleryItems = imageSources ?? photos
  const shownPhotos = galleryItems.slice(0, 3)

  const open = (trigger: HTMLButtonElement) => {
    if (onOpen) {
      onOpen(trigger)
      return
    }
    setOpener(trigger)
  }

  return <>
    <div className="detail-gallery" aria-label={`${placeName}の写真`}>
      {shownPhotos.map((photo, index) => <button className="detail-gallery__card" type="button" key={isImageSource(photo) ? photo.src : photo.name ?? index} onClick={(event) => open(event.currentTarget)} aria-label={`${placeName}の写真 ${index + 1}から一覧を開く`}>
        {isImageSource(photo) ? <img src={photo.src} alt={photo.alt} /> : <PlacePhoto photo={photo} alt={`${placeName}の写真 ${index + 1}`} width={360} attributions="hidden" as="span" />}
        {index === 2 && galleryItems.length > 3 && <span className="detail-gallery__more" aria-hidden="true">+{galleryItems.length - 3}</span>}
      </button>)}
    </div>
    {opener && <DetailPhotoViewer photos={photos} placeName={placeName} imageSources={imageSources} opener={opener} onClose={() => setOpener(null)} />}
  </>
}
