import { useSyncExternalStore } from 'react'

export type FavoriteRecord = {
  placeId: string
  addedAt: number
}

type FavoritesSnapshot = {
  favorites: readonly FavoriteRecord[]
  storageAvailable: boolean
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

const STORAGE_KEY = 'imahima:favorites:v1'
const STORAGE_VERSION = 1
const EMPTY_FAVORITES: readonly FavoriteRecord[] = []
const EMPTY_SNAPSHOT: FavoritesSnapshot = { favorites: EMPTY_FAVORITES, storageAvailable: true }

function isFavoriteRecord(value: unknown): value is FavoriteRecord {
  if (!value || typeof value !== 'object') return false

  const record = value as Record<string, unknown>
  return typeof record.placeId === 'string'
    && record.placeId.trim().length > 0
    && typeof record.addedAt === 'number'
    && Number.isFinite(record.addedAt)
}

export function parseFavoriteRecords(value: string | null): FavoriteRecord[] {
  if (!value) return []

  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') return []

    const payload = parsed as { version?: unknown; favorites?: unknown }
    if (payload.version !== STORAGE_VERSION || !Array.isArray(payload.favorites)) return []

    const seen = new Set<string>()
    return payload.favorites
      .filter(isFavoriteRecord)
      .map((record) => ({ placeId: record.placeId.trim(), addedAt: record.addedAt }))
      .filter((record) => {
        if (seen.has(record.placeId)) return false
        seen.add(record.placeId)
        return true
      })
      .sort((first, second) => second.addedAt - first.addedAt)
  } catch {
    return []
  }
}

function sameFavorites(first: readonly FavoriteRecord[], second: readonly FavoriteRecord[]) {
  return first.length === second.length && first.every((record, index) => (
    record.placeId === second[index]?.placeId && record.addedAt === second[index]?.addedAt
  ))
}

export class FavoritesStore {
  private snapshot = EMPTY_SNAPSHOT
  private readonly listeners = new Set<() => void>()
  private initialized = false

  constructor(private readonly storage: StorageLike | undefined, private readonly now = () => Date.now()) {}

  getSnapshot = () => {
    this.initialize()
    return this.snapshot
  }

  subscribe = (listener: () => void) => {
    this.initialize()
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  add(placeId: string) {
    this.initialize()
    const id = placeId.trim()
    if (!id || this.snapshot.favorites.some((record) => record.placeId === id)) return
    this.write([{ placeId: id, addedAt: this.now() }, ...this.snapshot.favorites])
  }

  remove(placeId: string) {
    this.initialize()
    this.write(this.snapshot.favorites.filter((record) => record.placeId !== placeId))
  }

  refresh = () => {
    if (!this.storage) {
      this.update(this.snapshot.favorites, false)
      return
    }

    try {
      this.update(parseFavoriteRecords(this.storage.getItem(STORAGE_KEY)), true)
    } catch {
      this.update(this.snapshot.favorites, false)
    }
  }

  private initialize() {
    if (this.initialized) return
    this.initialized = true
    this.refresh()
  }

  private write(favorites: readonly FavoriteRecord[]) {
    if (!this.storage) {
      this.update(favorites, false)
      return
    }

    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, favorites }))
      this.update(favorites, true)
    } catch {
      // Keep the action available for this tab, but never describe it as persisted.
      this.update(favorites, false)
    }
  }

  private update(favorites: readonly FavoriteRecord[], storageAvailable: boolean) {
    if (sameFavorites(favorites, this.snapshot.favorites) && storageAvailable === this.snapshot.storageAvailable) return
    this.snapshot = { favorites, storageAvailable }
    this.listeners.forEach((listener) => listener())
  }
}

function getBrowserStorage(): StorageLike | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

const favoritesStore = new FavoritesStore(getBrowserStorage())

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) favoritesStore.refresh()
  })
}

export function useFavorites() {
  const snapshot = useSyncExternalStore(favoritesStore.subscribe, favoritesStore.getSnapshot, () => EMPTY_SNAPSHOT)
  const isFavorite = (placeId: string) => snapshot.favorites.some((record) => record.placeId === placeId)

  return {
    favorites: snapshot.favorites,
    storageAvailable: snapshot.storageAvailable,
    isFavorite,
    addFavorite: favoritesStore.add.bind(favoritesStore),
    removeFavorite: favoritesStore.remove.bind(favoritesStore),
    toggleFavorite: (placeId: string) => {
      if (isFavorite(placeId)) favoritesStore.remove(placeId)
      else favoritesStore.add(placeId)
    },
  }
}

export function FavoriteButton({ placeId, className = 'favorite-button' }: { placeId: string; className?: string }) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const favorite = isFavorite(placeId)

  return <button
    type="button"
    className={className}
    aria-pressed={favorite}
    aria-label={favorite ? 'お気に入りから削除' : 'お気に入りに追加'}
    onClick={() => toggleFavorite(placeId)}
  >
    {favorite ? '保存済み' : 'お気に入り'}
  </button>
}

export function getFavoriteRecords() {
  return favoritesStore.getSnapshot().favorites
}
