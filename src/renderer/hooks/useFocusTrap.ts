import { useEffect, useRef, RefObject } from 'react'

/**
 * Custom hook for trapping focus within a container element.
 * Implements focus cycling: Tab at last element goes to first, Shift+Tab at first goes to last.
 * On mount, focuses the first focusable element.
 */
export function useFocusTrap<T extends HTMLElement>(isActive: boolean = true): RefObject<T | null> {
  const containerRef = useRef<T>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current

    // Get all focusable elements within the container
    const getFocusableElements = (): HTMLElement[] => {
      const focusableSelectors = [
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'a[href]',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ')

      return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors))
        .filter(el => el.offsetParent !== null) // Filter out hidden elements
    }

    // Focus the first focusable element on mount
    const focusableElements = getFocusableElements()
    if (focusableElements.length > 0) {
      // Delay focus slightly to ensure the modal is fully rendered
      requestAnimationFrame(() => {
        focusableElements[0].focus()
      })
    }

    // Handle keydown for focus trapping
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const focusable = getFocusableElements()
      if (focusable.length === 0) return

      const firstElement = focusable[0]
      const lastElement = focusable[focusable.length - 1]
      const activeElement = document.activeElement as HTMLElement

      if (event.shiftKey) {
        // Shift+Tab: if on first element, cycle to last
        if (activeElement === firstElement || !container.contains(activeElement)) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab: if on last element, cycle to first
        if (activeElement === lastElement || !container.contains(activeElement)) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)

    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  }, [isActive])

  return containerRef
}
