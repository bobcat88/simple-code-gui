import React from 'react'
import { cn } from '../../lib/utils'

type ButtonVariant = 'ghost' | 'default' | 'destructive' | 'icon'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  ghost:
    'bg-transparent text-[--text-secondary] hover:bg-[--border-default] hover:text-[--text-primary]',
  default:
    'bg-[--accent] text-[--accent-foreground] hover:bg-[--accent-hover]',
  destructive:
    'bg-[--destructive] text-[--destructive-foreground] hover:bg-[--destructive-hover]',
  icon:
    'bg-transparent text-[--text-tertiary] hover:bg-[--border-default] hover:text-[--text-primary] w-8 p-0 justify-center',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-xs',
  lg: 'h-9 px-4 text-sm',
}

export function Button({
  variant = 'ghost',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[--radius-md] font-medium',
        'transition-colors duration-[--duration-fast]',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--accent]',
        'disabled:opacity-40 disabled:pointer-events-none',
        'select-none',
        variantClasses[variant],
        variant === 'icon' ? 'h-8 w-8' : sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
