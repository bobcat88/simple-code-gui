import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

interface DialogState {
  type: 'error' | 'confirm' | 'info'
  message: string
  resolve: (value: boolean) => void
}

interface DialogContextValue {
  showError: (message: string) => void
  showConfirm: (message: string) => Promise<boolean>
  showInfo: (message: string) => void
}

const DialogContext = createContext<DialogContextValue | null>(null)

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)

  const showError = useCallback((message: string): void => {
    setDialog({ type: 'error', message, resolve: () => {} })
  }, [])

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setDialog({ type: 'confirm', message, resolve })
    })
  }, [])

  const showInfo = useCallback((message: string): void => {
    setDialog({ type: 'info', message, resolve: () => {} })
  }, [])

  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (dialog) {
      dialogRef.current?.focus()
    }
  }, [dialog])

  const handleClose = (value: boolean) => {
    dialog?.resolve(value)
    setDialog(null)
  }

  return (
    <DialogContext.Provider value={{ showError, showConfirm, showInfo }}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => handleClose(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-dialog-title"
            tabIndex={-1}
            className="bg-[var(--bg-surface,#18181b)] border border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Escape') handleClose(false) }}
          >
            <h2
              id="app-dialog-title"
              className="text-base font-semibold text-white mb-3"
            >
              {dialog.type === 'error' ? 'Error' : dialog.type === 'info' ? 'Info' : 'Confirm'}
            </h2>
            <p className="text-sm text-white/70 mb-6 whitespace-pre-wrap">{dialog.message}</p>
            <div className="flex justify-end gap-3">
              {dialog.type === 'confirm' && (
                <button
                  onClick={() => handleClose(false)}
                  className="px-4 py-2 text-sm rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => handleClose(true)}
                className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
                  dialog.type === 'confirm'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-white text-black hover:bg-white/90'
                }`}
              >
                {dialog.type === 'error' ? 'Dismiss' : dialog.type === 'info' ? 'OK' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog must be used inside DialogProvider')
  return ctx
}
