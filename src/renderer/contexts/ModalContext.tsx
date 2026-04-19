import React, { createContext, useContext, useState, useCallback } from 'react'

interface ModalContextValue {
  settingsOpen: boolean
  projectWizardOpen: boolean
  openSettings: () => void
  closeSettings: () => void
  openProjectWizard: () => void
  closeProjectWizard: () => void
}

const ModalContext = createContext<ModalContextValue | null>(null)

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [projectWizardOpen, setProjectWizardOpen] = useState(false)

  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const openProjectWizard = useCallback(() => setProjectWizardOpen(true), [])
  const closeProjectWizard = useCallback(() => setProjectWizardOpen(false), [])

  return (
    <ModalContext.Provider value={{
      settingsOpen,
      projectWizardOpen,
      openSettings,
      closeSettings,
      openProjectWizard,
      closeProjectWizard
    }}>
      {children}
    </ModalContext.Provider>
  )
}

export function useModals() {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModals must be used within a ModalProvider')
  }
  return context
}
