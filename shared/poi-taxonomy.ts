export const poiCategories = [
  'cafe',
  'food',
  'shopping',
  'entertainment',
  'sightseeing',
  'exercise',
  'park',
  'study',
  'rest',
] as const

export type PoiCategory = typeof poiCategories[number]

export const categoryLabels: Record<PoiCategory, string> = {
  cafe: 'カフェ',
  food: 'ごはん',
  shopping: '買い物',
  entertainment: '遊び',
  sightseeing: '観光',
  exercise: '運動',
  park: '自然',
  study: 'その他',
  rest: 'その他',
}

// These are Places API (New) Table A primary types.  Searching primary types
// keeps a hotel, station, or department store from matching merely because it
// contains a cafe or restaurant.  The complete any list has 50 types.
export const categoryPrimaryTypes: Record<PoiCategory, readonly string[]> = {
  cafe: ['cafe', 'coffee_shop', 'cat_cafe', 'dog_cafe'],
  food: ['restaurant', 'fast_food_restaurant', 'bakery', 'food_court', 'deli', 'cafeteria', 'donut_shop'],
  shopping: ['shopping_mall', 'department_store', 'book_store', 'clothing_store', 'toy_store', 'discount_store', 'gift_shop', 'supermarket', 'convenience_store', 'electronics_store', 'home_goods_store', 'thrift_store', 'shoe_store', 'jewelry_store', 'sportswear_store'],
  entertainment: ['amusement_center', 'amusement_park', 'movie_theater', 'bowling_alley', 'karaoke', 'video_arcade', 'internet_cafe', 'aquarium', 'performing_arts_theater'],
  sightseeing: ['tourist_attraction', 'museum', 'historical_landmark', 'cultural_landmark', 'monument', 'art_gallery', 'observation_deck', 'castle', 'shinto_shrine', 'buddhist_temple', 'sculpture'],
  exercise: ['gym', 'fitness_center', 'sports_complex', 'swimming_pool', 'ice_skating_rink', 'athletic_field', 'sports_club'],
  park: ['park', 'city_park', 'national_park', 'state_park', 'garden', 'botanical_garden', 'hiking_area', 'picnic_ground'],
  study: ['library', 'cafe', 'coffee_shop'],
  rest: ['cafe', 'coffee_shop', 'park', 'city_park', 'garden', 'plaza'],
}

const anyPrimaryTypes = [
  'cafe', 'coffee_shop',
  'restaurant', 'fast_food_restaurant', 'bakery', 'food_court', 'donut_shop',
  'shopping_mall', 'department_store', 'book_store', 'clothing_store', 'toy_store', 'discount_store', 'gift_shop', 'supermarket', 'electronics_store', 'sportswear_store',
  'amusement_center', 'amusement_park', 'movie_theater', 'bowling_alley', 'karaoke', 'video_arcade', 'internet_cafe', 'aquarium',
  'tourist_attraction', 'museum', 'historical_landmark', 'cultural_landmark', 'monument', 'art_gallery', 'observation_deck', 'shinto_shrine', 'buddhist_temple', 'sculpture',
  'gym', 'fitness_center', 'sports_complex', 'swimming_pool', 'ice_skating_rink', 'athletic_field', 'sports_club',
  'park', 'city_park', 'national_park', 'state_park', 'garden', 'botanical_garden', 'hiking_area',
  'library',
] as const

const categoryByType = new Map<string, PoiCategory>()
for (const category of poiCategories) {
  for (const type of categoryPrimaryTypes[category]) {
    // A type that supports a focused purpose keeps that purpose when it is the
    // actual primary type.  cafe therefore remains cafe outside a study/rest search.
    if (!categoryByType.has(type)) categoryByType.set(type, category)
  }
}

// A general restaurant primary type can represent more specific restaurant
// types.  A response missing primaryType can still contain those subtypes.
const foodFallbackTypes = new Set(['bakery', 'food', 'meal_takeaway', 'meal_delivery', 'fast_food_restaurant', 'restaurant', 'food_court', 'deli', 'cafeteria'])

function isRestaurantPrimaryType(type: string) {
  return type === 'restaurant' || type.endsWith('_restaurant')
}

export function isPoiCategory(value: string): value is PoiCategory {
  return (poiCategories as readonly string[]).includes(value)
}

export function primaryTypesForCategory(category: PoiCategory | 'any') {
  if (category !== 'any') return categoryPrimaryTypes[category]
  return anyPrimaryTypes
}

export function usesAssociatedTypeFilter(category: PoiCategory) {
  return category === 'entertainment' || category === 'park'
}

export function categoryMatchesSearch(category: PoiCategory, actualCategory: PoiCategory | undefined) {
  if (category === 'study') return actualCategory === 'study' || actualCategory === 'cafe'
  if (category === 'rest') return actualCategory === 'rest' || actualCategory === 'cafe' || actualCategory === 'park'
  if (category === 'sightseeing') return actualCategory === 'sightseeing' || actualCategory === 'park'
  return actualCategory === category
}

export function normalizePoiCategory(primaryType: string | null | undefined, types: readonly string[] = []): PoiCategory | undefined {
  // These providers use broad primary types for places whose activity is
  // explicit in their associated types.  Keep the override narrow so a normal
  // sports complex or cafe remains in its own category.
  if (primaryType === 'sports_complex' && types.includes('karaoke')) {
    return 'entertainment'
  }
  if (primaryType === 'cafe' && types.includes('internet_cafe')) {
    return 'entertainment'
  }

  // Google sometimes classifies public parks as tourist attractions.  Keep the
  // park tag decisive without treating ordinary attractions as parks.
  if (primaryType === 'tourist_attraction' && (types.includes('park') || types.includes('city_park'))) {
    return 'park'
  }
  const primaryCategory = primaryType ? categoryByType.get(primaryType) : undefined
  if (primaryCategory) return primaryCategory
  if (primaryType) {
    return foodFallbackTypes.has(primaryType) || isRestaurantPrimaryType(primaryType)
      ? 'food'
      : undefined
  }

  if (types.includes('casino')) return undefined

  // An absent primary type is documented as possible.  Only then fall back to
  // the secondary types, so a hotel with a cafe amenity never becomes a cafe.
  for (const type of types) {
    const category = categoryByType.get(type)
    if (category) return category
  }
  return types.some((type) => foodFallbackTypes.has(type)) ? 'food' : undefined
}
