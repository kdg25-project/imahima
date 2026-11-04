import type { ButtonHTMLAttributes } from 'react'
import arrowLarge from '../../assets/icons/arrow-large.svg'
import arrowSmall from '../../assets/icons/arrow-small.svg'

export type ButtonVariant = 'primary' | 'secondary'
export function buttonClassName(variant: ButtonVariant = 'primary', size: 'large' | 'small' = 'large') {
  return `button button--${variant} button--${size}`
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'large' | 'small'
  arrow?: boolean
}

export function Button({ variant = 'primary', size = 'large', arrow = false, type = 'button', className = '', children, ...props }: ButtonProps) {
  return <button {...props} type={type} className={`${buttonClassName(variant, size)} ${arrow ? 'button--arrow' : ''} ${className}`}><span>{children}</span>{arrow && <ButtonArrow size={size} />}</button>
}

export function ButtonArrow({ size = 'large' }: { size?: 'large' | 'small' }) {
  return <img className="button__arrow" src={size === 'large' ? arrowLarge : arrowSmall} alt="" aria-hidden="true" />
}
