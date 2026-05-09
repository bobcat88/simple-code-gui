import type { Transition, Variants, TargetAndTransition } from 'framer-motion'

export const DURATIONS = {
  fast: 0.1,
  normal: 0.15,
  slow: 0.2,
} as const

export const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1]

export function transition(duration: number, delay?: number): Transition {
  return {
    type: 'tween',
    duration,
    ease: EASE,
    ...(delay !== undefined ? { delay } : {}),
  }
}

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transition(DURATIONS.fast) },
}

export const fadeOut: Variants = {
  initial: { opacity: 1 },
  animate: { opacity: 0, transition: transition(DURATIONS.fast) },
}

export const slideDown: Variants = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0, transition: transition(DURATIONS.normal) },
  exit: { opacity: 0, y: -4, transition: transition(DURATIONS.fast) },
}

export const slideUp: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: transition(DURATIONS.normal) },
  exit: { opacity: 0, y: 4, transition: transition(DURATIONS.fast) },
}

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: transition(DURATIONS.normal) },
}

export const scaleOut: Variants = {
  initial: { opacity: 1, scale: 1 },
  animate: { opacity: 0, scale: 0.96, transition: transition(DURATIONS.fast) },
}

export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: transition(DURATIONS.normal) },
  exit: { opacity: 0, scale: 0.96, transition: transition(DURATIONS.fast) },
}

export const panelVariants: Variants = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0, transition: transition(DURATIONS.normal) },
  exit: { opacity: 0, x: -8, transition: transition(DURATIONS.fast) },
}

export const tapScale: { whileTap: TargetAndTransition } = {
  whileTap: { scale: 0.97 },
}

export const hoverScale: { whileHover: TargetAndTransition } = {
  whileHover: { scale: 1.02 },
}
