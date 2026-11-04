import type { ReactNode } from 'react'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'

export function DetailsLayout({ backAction, hero, children }: { backAction: ReactNode; hero?: ReactNode; children: ReactNode }) {
  return <div className="details-screen"><div className="details-hero">{hero}<div className="details-back">{backAction}</div></div><div className="details-sheet">{children}</div></div>
}

export function DetailRow({ icon, children, supplement }: { icon: IconName; children: ReactNode; supplement?: ReactNode }) {
  return <div className="detail-row"><Icon name={icon} /><span>{children}</span>{supplement && <span className="detail-row__supplement">{supplement}</span>}</div>
}
