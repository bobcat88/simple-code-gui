import React from 'react'
import { cn } from '../../lib/utils'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'data-active'?: boolean | string
  label: string
}

export function IconButton({
  className,
  children,
  label,
  ...props
}: IconButtonProps) {
  const isActive =
    props['data-active'] === true || props['data-active'] === 'true'

  return (
    <button
      aria-label={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-[--radius-md]',
        'text-[--text-tertiary] transition-colors duration-[--duration-fast]',
        'hover:bg-[--border-default] hover:text-[--text-primary]',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--accent]',
        'disabled:opacity-40 disabled:pointer-events-none select-none',
        isActive && 'bg-[--border-default] text-[--text-primary]',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
