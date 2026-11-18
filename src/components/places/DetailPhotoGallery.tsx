import { useEffect, useRef, useState } from 'react'
import type { PlacePhoto as PlacePhotoDTO } from '../../lib/api'
import { PlacePhoto } from './PlacePhoto'

type DetailPhotoGalleryProps = {
  photos: PlacePhotoDTO[]
  placeName: string
  imageSources?: { src: string; alt: string }[]
}

export function DetailPhotoGallery({ photos, placeName, imageSources }: DetailPhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const viewerRef = useRef<HTMLElement | null>(null)
  const activePhoto = activeIndex === undefined ? undefined : photos[activeIndex]
  const activeImage = activeIndex === undefined ? undefined : imageSources?.[activeIndex]
  const totalPhotos = imageSources?.length ?? photos.length

  useEffect(() => {
    if (activeIndex === undefined) {
      triggerRef.current?.focus()
      return
    }
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setActiveIndex(undefined)
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
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [activeIndex])

  const close = () => {
    setActiveIndex(undefined)
  }
  const open = (index: number, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger
    setActiveIndex(index)
  }
  const shownPhotos = imageSources ? imageSources.slice(0, 3) : photos.slice(0, 3)

  return <>
    <div className="detail-gallery" aria-label={`${placeName}の写真`}>
      {shownPhotos.map((photo, index) => <button className="detail-gallery__card" type="button" key={'src' in photo ? photo.src : photo.name ?? index} onClick={(event) => open(index, event.currentTarget)} aria-label={`${placeName}の写真 ${index + 1}を拡大`}>
        {'src' in photo ? <img src={photo.src} alt={photo.alt} /> : <PlacePhoto photo={photo} alt={`${placeName}の写真 ${index + 1}`} width={360} attributions="hidden" as="span" />}
        {index === 2 && totalPhotos > 3 && <span className="detail-gallery__more" aria-hidden="true">+{totalPhotos - 3}</span>}
      </button>)}
    </div>
    {(activePhoto || activeImage) && activeIndex !== undefined ? <div className="detail-photo-viewer" role="dialog" aria-modal="true" aria-label={`${placeName}の写真 ${activeIndex + 1}`}>
      <div className="detail-photo-viewer__backdrop" onClick={close} />
      <section className="detail-photo-viewer__content" ref={viewerRef}>
        <button ref={closeRef} className="detail-photo-viewer__close" type="button" onClick={close} aria-label="写真を閉じる">×</button>
        {activeImage ? <img className="detail-photo-viewer__image" src={activeImage.src} alt={activeImage.alt} /> : <PlacePhoto photo={activePhoto} alt={`${placeName}の写真 ${activeIndex + 1}`} width={1200} showAttributionAvatars />}
        {totalPhotos > 1 && <div className="detail-photo-viewer__controls" aria-label="写真を切り替え">
          <button type="button" onClick={() => setActiveIndex((activeIndex + totalPhotos - 1) % totalPhotos)}>前の写真</button>
          <span aria-live="polite">{activeIndex + 1} / {totalPhotos}</span>
          <button type="button" onClick={() => setActiveIndex((activeIndex + 1) % totalPhotos)}>次の写真</button>
        </div>}
      </section>
    </div> : null}
  </>
}
