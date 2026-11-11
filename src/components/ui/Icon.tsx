import clock from '../../assets/icons/clock.svg'
import pin from '../../assets/icons/pin.svg'
import map from '../../assets/icons/map.svg'
import down from '../../assets/icons/chevron-down.svg'
import filters from '../../assets/icons/filters.svg'
import pinSmall from '../../assets/icons/pin-small.svg'
import clockSmall from '../../assets/icons/clock-small.svg'
import chevron from '../../assets/icons/chevron.svg'
import star from '../../assets/icons/star.svg'
import walk from '../../assets/icons/walk.svg'
import clockDetail from '../../assets/icons/clock-detail.svg'
import pinDetail from '../../assets/icons/pin-detail.svg'
import direction from '../../assets/icons/direction.svg'
import phone from '../../assets/icons/phone.svg'

const icons = { clock, pin, map, down, filters, pinSmall, clockSmall, chevron, star, walk, clockDetail, pinDetail, direction, phone }
export type IconName = keyof typeof icons

// Preserve each exported SVG's intrinsic dimensions; the slot controls spacing.
export function Icon({ name }: { name: IconName }) {
  return <span className={`icon icon--${name}`} aria-hidden="true"><img src={icons[name]} alt="" /></span>
}

// Figma's category icon consists of four rounded rectangles, not an image asset.
export function CategoryGlyph() {
  return <span className="category-glyph" aria-hidden="true"><i /><i /><i /><i /></span>
}
