import React from 'react'
import { cn } from '../../lib/utils'

type StatusDotState = 'idle' | 'running' | 'error' | 'warning'

interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  state?: StatusDotState
}

const stateClasses: Record<StatusDotState, string> = {
  idle: 'bg-[--text-tertiary]',
  running: 'bg-[--accent]',
  error: 'bg-[--destructive]',
  warning: 'bg-[--warning]',
}

export function StatusDot({ state = 'idle', className, ...props }: StatusDotProps) {
  return (
    <span
      role="status"
      aria-label={state}
      className={cn(
        'inline-block h-1.5 w-1.5 rounded-full shrink-0',
        stateClasses[state],
        className
      )}
      {...props}
    />
  )
}
