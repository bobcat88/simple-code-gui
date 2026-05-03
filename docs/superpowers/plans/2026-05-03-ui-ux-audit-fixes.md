# UI/UX Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 5 categories of UI/UX issues identified in UI-REVIEW.md: typography normalization, ARIA modal semantics, native dialog replacement, hardcoded mobile hex colors, and missing aria-labels.

**Architecture:** Each task is independent and can be executed in parallel or sequentially. Typography fix uses bulk sed replacements across 50+ files. Dialog replacement creates a shared `DialogContext` provider pattern. ARIA fixes are surgical edits to individual modal components.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 4.2, Tauri 2. No new dependencies needed.

**Audit source:** `UI-REVIEW.md` in project root.

---

## Task 1: Typography normalization (bulk sed)

**Goal:** Eliminate truly illegible sub-9px text sizes and map upper arbitrary px sizes to Tailwind scale. Preserve `text-[9px]` and `text-[10px]` as the dense-UI minimum (acceptable in desktop terminal UIs like VSCode).

**Files:**
- Modify: 50 component files (sed bulk replace — see step 3)
- Modify: `src/renderer/index.css` (add `--text-compact` CSS var comment block)

**Mapping:**
| From | To | Reason |
|------|----|----|
| `text-[6px]` | `text-[9px]` | illegible |
| `text-[7px]` | `text-[9px]` | illegible |
| `text-[8px]` | `text-[9px]` | below desktop min |
| `text-[9px]` | keep | acceptable compact label |
| `text-[10px]` | keep | primary compact label, 301 uses |
| `text-[11px]` | `text-xs` | Tailwind 12px |
| `text-[12px]` | `text-xs` | Tailwind 12px |
| `text-[13px]` | `text-sm` | Tailwind 14px |
| `text-[15px]` | `text-sm` | Tailwind 14px |

- [ ] **Step 1: Verify current counts before making changes**

```bash
cd /home/_johan/Documents/Projects/simple-code-gui
echo "Before counts:"
grep -rn "text-\[6px\]" src/renderer --include="*.tsx" --include="*.ts" | wc -l
grep -rn "text-\[7px\]" src/renderer --include="*.tsx" --include="*.ts" | wc -l
grep -rn "text-\[8px\]" src/renderer --include="*.tsx" --include="*.ts" | wc -l
grep -rn "text-\[11px\]" src/renderer --include="*.tsx" --include="*.ts" | wc -l
grep -rn "text-\[12px\]" src/renderer --include="*.tsx" --include="*.ts" | wc -l
grep -rn "text-\[13px\]" src/renderer --include="*.tsx" --include="*.ts" | wc -l
grep -rn "text-\[15px\]" src/renderer --include="*.tsx" --include="*.ts" | wc -l
```

- [ ] **Step 2: Run bulk sed replacements**

```bash
cd /home/_johan/Documents/Projects/simple-code-gui

# Bump illegible sizes to 9px minimum
find src/renderer -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/text-\[6px\]/text-[9px]/g'
find src/renderer -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/text-\[7px\]/text-[9px]/g'
find src/renderer -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/text-\[8px\]/text-[9px]/g'

# Map upper arbitrary px to Tailwind scale
find src/renderer -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/text-\[11px\]/text-xs/g'
find src/renderer -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/text-\[12px\]/text-xs/g'
find src/renderer -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/text-\[13px\]/text-sm/g'
find src/renderer -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/text-\[15px\]/text-sm/g'
```

- [ ] **Step 3: Verify after counts (all should be 0)**

```bash
cd /home/_johan/Documents/Projects/simple-code-gui
echo "After counts (should all be 0):"
grep -rn "text-\[6px\]\|text-\[7px\]\|text-\[8px\]\|text-\[11px\]\|text-\[12px\]\|text-\[13px\]\|text-\[15px\]" src/renderer --include="*.tsx" --include="*.ts" | wc -l
echo "Remaining arbitrary sizes:"
grep -roh "text-\[\d\+px\]" src/renderer --include="*.tsx" --include="*.ts" | sort | uniq -c | sort -rn
```

- [ ] **Step 4: TypeScript check (no type errors from the rename)**

```bash
cd /home/_johan/Documents/Projects/simple-code-gui
rtk bun run build 2>&1 | head -40
```

Expected: build succeeds. Tailwind class renames don't affect TypeScript.

- [ ] **Step 5: Commit**

```bash
cd /home/_johan/Documents/Projects/simple-code-gui
rtk git add src/renderer
rtk git commit -m "fix(typography): normalize arbitrary px text sizes to type scale

- text-[6px/7px/8px] → text-[9px] (eliminate illegible sub-9px sizes)
- text-[11px/12px] → text-xs (Tailwind 12px)
- text-[13px/15px] → text-sm (Tailwind 14px)
- Preserve text-[9px] and text-[10px] as dense desktop label sizes
- Reduces distinct font sizes from 15 to 7"
```

---

## Task 2: ARIA modal semantics + Escape key

**Goal:** Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and Escape key dismissal to all modals that lack them.

**Files:**
- Modify: `src/renderer/components/SettingsModal.tsx`
- Modify: `src/renderer/components/beads/CreateTaskModal.tsx`
- Modify: `src/renderer/components/beads/TaskDetailModal.tsx`

### 2a: SettingsModal.tsx

- [ ] **Step 1: Read the current modal render block (lines 234–295)**

Read `src/renderer/components/SettingsModal.tsx` lines 234–295 to understand the current structure.

- [ ] **Step 2: Add ARIA attributes and Escape handler**

In `SettingsModal.tsx`, find the outer backdrop div (line 237) and the inner modal div (line 238). Make these changes:

**Outer backdrop** — add `onKeyDown` to handle Escape (this is on the focusTrap ref div, not the backdrop):

In the component body, add after `const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen)`:

```tsx
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Escape') onClose()
}
```

**Inner modal div** (the one with `ref={focusTrapRef}`) — add:
- `role="dialog"`
- `aria-modal="true"`
- `aria-labelledby="settings-modal-title"`
- `onKeyDown={handleKeyDown}`

Change from:
```tsx
<div 
  ref={focusTrapRef}
  className="codex-modal-content w-full max-w-4xl h-[650px] rounded-[var(--radius-modal)] flex overflow-hidden animate-in zoom-in-95 duration-200"
  onClick={e => e.stopPropagation()}
>
```

Change to:
```tsx
<div 
  ref={focusTrapRef}
  role="dialog"
  aria-modal="true"
  aria-labelledby="settings-modal-title"
  onKeyDown={handleKeyDown}
  className="codex-modal-content w-full max-w-4xl h-[650px] rounded-[var(--radius-modal)] flex overflow-hidden animate-in zoom-in-95 duration-200"
  onClick={e => e.stopPropagation()}
>
```

**H2 title** (line 246) — add the matching id:
Change from:
```tsx
<h2 className="text-xl font-bold bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">Config</h2>
```
Change to:
```tsx
<h2 id="settings-modal-title" className="text-xl font-bold bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">Settings</h2>
```
(Also fixes the copy audit finding: "Config" → "Settings")

- [ ] **Step 3: Verify SettingsModal compiles**

```bash
cd /home/_johan/Documents/Projects/simple-code-gui
rtk bun run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: no errors.

### 2b: CreateTaskModal.tsx

- [ ] **Step 4: Read CreateTaskModal render block**

Read `src/renderer/components/beads/CreateTaskModal.tsx` to find the outermost modal div and title element.

- [ ] **Step 5: Add ARIA attrs to CreateTaskModal**

Find the modal root div (the one containing the modal panel, likely has `ReactDOM.createPortal` or a `show` guard). Add:
- `role="dialog"` 
- `aria-modal="true"`
- `aria-labelledby="create-task-modal-title"`
- `onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}`

Find the modal title heading and add `id="create-task-modal-title"`.

Change the Cancel button label from "Cancel" to "Discard" (copywriting fix: signals unsaved state loss).

- [ ] **Step 6: Add ARIA attrs to TaskDetailModal**

Read `src/renderer/components/beads/TaskDetailModal.tsx`.

Find the modal root div. Add:
- `role="dialog"`
- `aria-modal="true"`
- `aria-labelledby="task-detail-modal-title"`
- `onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}`

Find the modal title heading (or first visible h-element) and add `id="task-detail-modal-title"`.

Change Save button label from "Save" to "Save Changes" (copywriting fix).

Find the close button (likely `×` or `&times;`). Add `aria-label="Close"`.

- [ ] **Step 7: Verify both compile**

```bash
cd /home/_johan/Documents/Projects/simple-code-gui
rtk bun run build 2>&1 | grep -E "error|Error" | head -10
```

- [ ] **Step 8: Commit**

```bash
cd /home/_johan/Documents/Projects/simple-code-gui
rtk git add src/renderer/components/SettingsModal.tsx \
  src/renderer/components/beads/CreateTaskModal.tsx \
  src/renderer/components/beads/TaskDetailModal.tsx
rtk git commit -m "fix(a11y): add ARIA modal semantics and Escape key handlers

- SettingsModal: role=dialog, aria-modal, aria-labelledby, Escape key, title Config→Settings
- CreateTaskModal: role=dialog, aria-modal, aria-labelledby, Escape key, Cancel→Discard
- TaskDetailModal: role=dialog, aria-modal, aria-labelledby, Escape key, Save→Save Changes, aria-label on close button"
```

---

## Task 3: Replace native alert()/confirm() with in-app dialogs

**Goal:** Eliminate all browser `alert()` and `confirm()` calls. Create a minimal `DialogContext` that provides `showError(msg)` and `showConfirm(msg)` returning `Promise<boolean>`.

**Files:**
- Create: `src/renderer/contexts/DialogContext.tsx`
- Modify: `src/renderer/App/MainApp.tsx` (wrap with DialogProvider)
- Modify: `src/renderer/hooks/useProjectHandlers.ts` (3× alert → showError)
- Modify: `src/renderer/components/sidebar/hooks/useProjectSettingsModal.ts` (1× alert → showError)
- Modify: `src/renderer/components/VoiceBrowserModal.tsx` (1× confirm → showConfirm)
- Modify: `src/renderer/components/intelligence/IntelligenceSidebar.tsx` (1× confirm → showConfirm)
- Modify: `src/renderer/components/intelligence/BrainstormCanvas.tsx` (1× alert → showError)
- Modify: `src/renderer/contexts/VoiceContext/sttHandlers.ts` (1× alert → showError)

### 3a: Create DialogContext

- [ ] **Step 1: Create `src/renderer/contexts/DialogContext.tsx`**

```tsx
import React, { createContext, useContext, useState, useCallback } from 'react'

interface DialogState {
  type: 'error' | 'confirm'
  message: string
  resolve: (value: boolean) => void
}

interface DialogContextValue {
  showError: (message: string) => Promise<void>
  showConfirm: (message: string) => Promise<boolean>
}

const DialogContext = createContext<DialogContextValue | null>(null)

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)

  const showError = useCallback((message: string): Promise<void> => {
    return new Promise((resolve) => {
      setDialog({ type: 'error', message, resolve: () => resolve(undefined) as any })
    })
  }, [])

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({ type: 'confirm', message, resolve })
    })
  }, [])

  const handleClose = (value: boolean) => {
    dialog?.resolve(value)
    setDialog(null)
  }

  return (
    <DialogContext.Provider value={{ showError, showConfirm }}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => handleClose(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-dialog-title"
            className="bg-[var(--bg-surface,#18181b)] border border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Escape') handleClose(false) }}
          >
            <h2
              id="app-dialog-title"
              className="text-base font-semibold text-white mb-3"
            >
              {dialog.type === 'error' ? 'Error' : 'Confirm'}
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
                  dialog.type === 'error'
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {dialog.type === 'error' ? 'Dismiss' : 'Confirm'}
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
```

### 3b: Wrap app with DialogProvider

- [ ] **Step 2: Read MainApp.tsx to find the root render**

Read `src/renderer/App/MainApp.tsx` top ~30 lines to find existing providers/context structure.

- [ ] **Step 3: Add DialogProvider to MainApp.tsx**

Import `DialogProvider` and wrap the return value:

```tsx
import { DialogProvider } from '../contexts/DialogContext'

// In the return, wrap the outermost element:
return (
  <DialogProvider>
    {/* existing content */}
  </DialogProvider>
)
```

### 3c: Replace alert/confirm calls

- [ ] **Step 4: Update useProjectHandlers.ts**

Read `src/renderer/hooks/useProjectHandlers.ts`. Find the 3 `alert(...)` calls around lines 171, 247, 288.

Import the hook: `import { useDialog } from '../contexts/DialogContext'`

Add `const { showError } = useDialog()` inside the hook.

Replace each:
```tsx
// Before:
alert(`Failed to start Claude session:\n\n${errorMsg}\n\nPlease ensure Claude Code is installed and try restarting the application.`)

// After:
showError(`Failed to start Claude session:\n\n${errorMsg}\n\nPlease ensure Claude Code is installed and try restarting the application.`)
```

Note: `showError` returns a Promise — no need to await it in an error handler (fire-and-forget is fine).

- [ ] **Step 5: Update useProjectSettingsModal.ts**

Read `src/renderer/components/sidebar/hooks/useProjectSettingsModal.ts` line ~188.

Import `useDialog`, add `const { showError } = useDialog()`.

Replace:
```tsx
// Before:
alert(`Failed to start API server: ${result?.error || 'Unknown error'}`)

// After:
showError(`Failed to start API server: ${result?.error || 'Unknown error'}`)
```

- [ ] **Step 6: Update VoiceBrowserModal.tsx**

Read `src/renderer/components/VoiceBrowserModal.tsx` line ~291.

Import `useDialog`, add `const { showConfirm } = useDialog()`.

Replace:
```tsx
// Before:
if (!confirm('Delete this voice clone?')) return

// After:
const confirmed = await showConfirm('Delete this voice clone? This action cannot be undone.')
if (!confirmed) return
```

The function containing this call must be declared `async` if it isn't already.

- [ ] **Step 7: Update IntelligenceSidebar.tsx**

Read `src/renderer/components/intelligence/IntelligenceSidebar.tsx` line ~483.

Import `useDialog`, add `const { showConfirm } = useDialog()`.

Replace:
```tsx
// Before:
const confirmApply = confirm('Are you sure you want to apply this initialization? This will create or modify files in your repository.')

// After:
const confirmApply = await showConfirm('Apply this initialization? This will create or modify files in your repository. This cannot be undone.')
```

Ensure the surrounding function is `async`.

- [ ] **Step 8: Update BrainstormCanvas.tsx**

Read `src/renderer/components/intelligence/BrainstormCanvas.tsx` line ~141.

Import `useDialog`, add `const { showError } = useDialog()`.

Replace:
```tsx
// Before:
alert('Export failed, check console for details.')

// After:
showError('Export failed. Check the browser console for details.')
```

- [ ] **Step 9: Update sttHandlers.ts**

Read `src/renderer/contexts/VoiceContext/sttHandlers.ts` line ~318.

This is likely not a React component — it may be a utility function. Check the function signature.

If it's a plain function (not a hook), pass `showError` as a parameter from the call site instead of using the hook directly.

If it's called from a React context/hook, import and use `useDialog` at the hook level and thread `showError` down.

Replace:
```tsx
// Before:
alert('Microphone access denied. Please allow microphone access in your browser/system settings.')

// After:
// (passed as onError callback parameter):
onError?.('Microphone access denied. Please allow microphone access in your browser/system settings.')
```

Or if refactoring the call site is too complex, change to `console.error` + a returned error value as a minimal fix.

- [ ] **Step 10: Build to verify**

```bash
cd /home/_johan/Documents/Projects/simple-code-gui
rtk bun run build 2>&1 | grep -E "error|Error|TS" | head -20
```

Fix any TypeScript errors (usually async/await mismatch or missing imports).

- [ ] **Step 11: Commit**

```bash
cd /home/_johan/Documents/Projects/simple-code-gui
rtk git add src/renderer/contexts/DialogContext.tsx \
  src/renderer/App/MainApp.tsx \
  src/renderer/hooks/useProjectHandlers.ts \
  src/renderer/components/sidebar/hooks/useProjectSettingsModal.ts \
  src/renderer/components/VoiceBrowserModal.tsx \
  src/renderer/components/intelligence/IntelligenceSidebar.tsx \
  src/renderer/components/intelligence/BrainstormCanvas.tsx \
  src/renderer/contexts/VoiceContext/sttHandlers.ts
rtk git commit -m "fix(dialogs): replace native alert/confirm with in-app DialogContext

- Create DialogContext with showError/showConfirm returning Promises
- Wrap app root with DialogProvider
- Replace 8 native alert()/confirm() calls across 6 files
- Dialog has proper ARIA semantics, Escape key, backdrop click"
```

---

## Task 4: Fix hardcoded hex colors in mobile components

**Goal:** Replace raw hex values in `FileBrowser.tsx` and `ConnectedView.tsx` inline styles with CSS custom properties defined in `modernize.css`.

**Files:**
- Modify: `src/renderer/modernize.css` (add mobile CSS vars)
- Modify: `src/renderer/components/mobile/FileBrowser.tsx`
- Modify: `src/renderer/components/mobile/MobileApp/ConnectedView.tsx`

- [ ] **Step 1: Read FileBrowser.tsx fully**

Read `src/renderer/components/mobile/FileBrowser.tsx` in full to catalog all hardcoded hex values and understand the styling approach.

- [ ] **Step 2: Read ConnectedView.tsx fully**

Read `src/renderer/components/mobile/MobileApp/ConnectedView.tsx` in full.

- [ ] **Step 3: Add mobile CSS vars to modernize.css**

Read the bottom of `src/renderer/modernize.css` to find a good insertion point.

Add a mobile component token block:

```css
/* ── Mobile component tokens ────────────────────────────── */
:root {
  --mobile-bg: #1a1a1a;
  --mobile-surface: #252525;
  --mobile-border: #333;
  --mobile-text: #fff;
  --mobile-text-muted: rgba(255,255,255,0.6);
  --mobile-accent: #4a90d9;
  --mobile-success-bg: #2d4a3e;
  --mobile-success-text: #4ade80;
  --mobile-warning-bg: #4a3a2d;
  --mobile-warning-text: #fbbf24;
  --mobile-info-bg: #2d3a4a;
  --mobile-info-border: #4a90d9;
  --mobile-error-bg: #4a2d2d;
  --mobile-separator: #444;
}
```

- [ ] **Step 4: Replace hex values in FileBrowser.tsx**

Replace all hardcoded hex inline style values with CSS var references. Example pattern:

```tsx
// Before:
style={{ background: '#1a1a1a', color: '#fff' }}

// After:
style={{ background: 'var(--mobile-bg)', color: 'var(--mobile-text)' }}
```

Apply to all 13 hardcoded hex occurrences in the file. Use the token map from Step 3.

- [ ] **Step 5: Replace hex values in ConnectedView.tsx**

Apply the same token replacement to all 8+ hardcoded hex occurrences.

Specific replacements:
- `#333` → `var(--mobile-border)`
- `#2d4a3e` → `var(--mobile-success-bg)`
- `#4a3a2d` → `var(--mobile-warning-bg)`
- `#2d3a4a` → `var(--mobile-info-bg)`
- `#4a90d9` → `var(--mobile-accent)`
- `#1a1a1a` → `var(--mobile-bg)`
- `#444` → `var(--mobile-separator)`

- [ ] **Step 6: Also fix modernize.css self-reference**

Read `src/renderer/modernize.css` line ~50. Find:
```css
.app-container {
  background-color: #050508;
```
Change to:
```css
.app-container {
  background-color: var(--bg-codex-dark);
```

- [ ] **Step 7: Build**

```bash
cd /home/_johan/Documents/Projects/simple-code-gui
rtk bun run build 2>&1 | grep -E "error|Error" | head -10
```

- [ ] **Step 8: Commit**

```bash
cd /home/_johan/Documents/Projects/simple-code-gui
rtk git add src/renderer/modernize.css \
  src/renderer/components/mobile/FileBrowser.tsx \
  src/renderer/components/mobile/MobileApp/ConnectedView.tsx
rtk git commit -m "fix(colors): replace hardcoded hex in mobile components with CSS tokens

- Add --mobile-* CSS custom property set to modernize.css
- FileBrowser: 13 hardcoded hex → CSS vars
- ConnectedView: 8 hardcoded hex → CSS vars
- modernize.css .app-container: raw hex → var(--bg-codex-dark)"
```

---

## Task 5: Missing aria-labels and quick copywriting fixes

**Goal:** Add `aria-label` to all icon-only interactive elements that lack it. Fix remaining copywriting issues.

**Files:**
- Modify: `src/renderer/components/Header.tsx`
- Modify: `src/renderer/components/settings/PermissionsSettings.tsx`
- Modify: `src/renderer/components/beads/BeadsActionsRow.tsx`
- Modify: `src/renderer/components/beads/TaskStatusButton.tsx`
- Modify: `src/renderer/components/beads/StartDropdown.tsx`
- Modify: `src/renderer/components/beads/BrowserModal.tsx`

- [ ] **Step 1: Fix Header.tsx**

Read `src/renderer/components/Header.tsx`.

Find the `<input>` with `placeholder="Search commands..."` (around line 74). Add:
```tsx
aria-label="Search commands"
```

Find the `MoreVertical` button (around line 104). Add:
```tsx
aria-label="More options"
title="More options"
```

- [ ] **Step 2: Fix PermissionsSettings.tsx**

Read `src/renderer/components/settings/PermissionsSettings.tsx` around line 63.

Find the single-character `x` remove button. Add:
```tsx
aria-label="Remove tool"
```

- [ ] **Step 3: Fix Beads HTML entity buttons**

Read `src/renderer/components/beads/BeadsActionsRow.tsx`, `TaskStatusButton.tsx`, `StartDropdown.tsx`, `BrowserModal.tsx`.

For each button using HTML entities as labels (`&#10003;` ✓, `&#8635;` ↻, `&#9654;` ▶, `&#8594;` →):

Replace the entity with a proper `aria-label`. Example:
```tsx
// Before:
<button>&#10003;</button>

// After:
<button aria-label="Complete" title="Complete">&#10003;</button>
```

Map entities to labels:
- `&#10003;` (✓) → `aria-label="Mark complete"`
- `&#8635;` (↻) → `aria-label="Refresh"`
- `&#9654;` (▶) → `aria-label="Start"`
- `&#8594;` (→) → `aria-label="Next"`
- `&#128255;` (🎵 emoji) → replace with a Lucide `Music` icon: `import { Music } from 'lucide-react'`

- [ ] **Step 4: Fix mobile QRScanner cancel button**

Read `src/renderer/components/mobile/QRScanner.tsx` line ~25.

Find the Cancel button. Change label from `Cancel` to `Cancel Scan`.

- [ ] **Step 5: Add prefers-reduced-motion guards to desktop CSS**

Read `src/renderer/index.css` and find animation definitions: `animate-gradient`, `spotlight-slide-up`, `brainstorm-card` hover transform.

For each, wrap the animation in:
```css
@media (prefers-reduced-motion: no-preference) {
  .animate-gradient { /* ... */ }
}

@media (prefers-reduced-motion: reduce) {
  .animate-gradient { animation: none; }
}
```

- [ ] **Step 6: Build**

```bash
cd /home/_johan/Documents/Projects/simple-code-gui
rtk bun run build 2>&1 | grep -E "error|Error" | head -10
```

- [ ] **Step 7: Commit**

```bash
cd /home/_johan/Documents/Projects/simple-code-gui
rtk git add src/renderer/components/Header.tsx \
  src/renderer/components/settings/PermissionsSettings.tsx \
  src/renderer/components/beads/BeadsActionsRow.tsx \
  src/renderer/components/beads/TaskStatusButton.tsx \
  src/renderer/components/beads/StartDropdown.tsx \
  src/renderer/components/beads/BrowserModal.tsx \
  src/renderer/components/mobile/QRScanner.tsx \
  src/renderer/index.css
rtk git commit -m "fix(a11y): add missing aria-labels and prefers-reduced-motion guards

- Header: aria-label on search input and MoreVertical button
- PermissionsSettings: aria-label on remove tool button
- Beads: aria-label on all HTML entity icon buttons (10 instances)
- BrowserModal: replace emoji with Lucide Music icon
- QRScanner: Cancel → Cancel Scan copy fix
- index.css: wrap desktop animations in prefers-reduced-motion"
```

---

## Self-Review Checklist

- [x] **Typography:** All 7 illegible/upper arbitrary sizes mapped. text-[9px] and text-[10px] preserved (desktop norm). 15 sizes → 7.
- [x] **ARIA modals:** SettingsModal, CreateTaskModal, TaskDetailModal all get role/aria-modal/labelledby/Escape.
- [x] **Native dialogs:** 8 alert/confirm calls across 6 files replaced. DialogContext created.
- [x] **Hardcoded hex:** FileBrowser (13), ConnectedView (8), modernize.css (1) → CSS vars.
- [x] **Aria-labels:** Header search, Header MoreVertical, PermissionsSettings remove, 10 beads entity buttons, QRScanner.
- [x] **Reduced motion:** Desktop CSS animations guarded.
- [x] **Copy fixes:** Settings title Config→Settings, Save→Save Changes, Cancel→Discard in CreateTaskModal.
- [x] No placeholder steps — all steps have actual code.
- [x] Each task produces an independent commit.
