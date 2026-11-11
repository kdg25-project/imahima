import type { ReactNode } from 'react'
import { Button } from './Button'
import type { ComponentProps } from 'react'

type IconButtonProps = Omit<ComponentProps<typeof Button>, 'children' | 'aria-label'> & {
  label: string
  icon: ReactNode
}

export function IconButton({ label, icon, className = '', ...props }: IconButtonProps) {
  return <Button {...props} aria-label={label} className={`icon-button ${className}`}><span aria-hidden="true">{icon}</span></Button>
}
