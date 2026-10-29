import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

export function Chip({ className = '', tone = 'neutral', compact = false, ...props }: HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'positive'
  compact?: boolean
}) {
  return <span {...props} className={`chip chip--${tone} ${compact ? 'chip--compact' : ''} ${className}`} />
}

type ChoiceChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & { selected: boolean; icon?: ReactNode }
export function ChoiceChip({ selected, icon, children, className = '', type = 'button', ...props }: ChoiceChipProps) {
  return <button {...props} type={type} aria-pressed={selected} className={`choice-chip ${className}`}>{icon}{children}</button>
}
