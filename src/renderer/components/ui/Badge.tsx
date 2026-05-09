import React from 'react'
import { cn } from '../../lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[--border-default] text-[--text-secondary]',
  success: 'bg-[--success-subtle] text-[--success]',
  warning: 'bg-[--warning-subtle] text-[--warning]',
  error: 'bg-[--destructive-subtle] text-[--destructive]',
  info: 'bg-[--info-subtle] text-[--info]',
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[--radius-sm]',
        'px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
