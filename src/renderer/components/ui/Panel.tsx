import React from 'react'
import { cn } from '../../lib/utils'

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  border?: boolean
  padding?: boolean
}

export function Panel({ border = false, padding = false, className, children, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        'bg-[--surface-1]',
        border && 'border border-[--border-subtle]',
        padding && 'p-3',
        'rounded-[--radius-lg]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
