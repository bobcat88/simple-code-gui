# UI Review — simple-code-gui

**Date:** 2026-05-03
**Auditor:** gsd-ui-auditor
**Scope:** Full frontend codebase retroactive audit — 6-pillar standards (no UI-SPEC.md present)
**Screenshots:** Not captured (no dev server detected on ports 3000, 5173, 8080)
**Baseline:** Abstract 6-pillar UX standards + UI/UX Best Practices knowledge base

---

## Score Summary

| Pillar | Score | Grade |
|--------|-------|-------|
| Copywriting | 2/4 | WARNING |
| Visuals | 3/4 | WARNING |
| Color | 2/4 | WARNING |
| Typography | 1/4 | BLOCKER |
| Spacing | 2/4 | WARNING |
| Experience Design | 2/4 | WARNING |
| **Overall** | **12/24** | |

---

## Top 5 Fixes

1. **Replace 9 arbitrary px text size classes with Tailwind type-scale tokens** — The entire component tree uses `text-[6px]` through `text-[15px]` (516+ instances) instead of design-system tokens. This makes the type system unmaintainable, violates the type scale contract, and produces sub-10px text that fails WCAG readability minimums at normal DPI. Fix: map to `text-xs` (12px), `text-sm` (14px), `text-base` (16px) — delete every `text-[N px]` class.

2. **Add `role="dialog"` + `aria-modal="true"` + Escape key handler to all modals** — SettingsModal, CreateTaskModal, TaskDetailModal, and BeadsModal have zero ARIA modal semantics. Screen readers do not know these are dialogs and cannot enforce modal context. `useFocusTrap` handles Tab cycling but does NOT handle Escape key dismissal. Fix: add `role="dialog" aria-modal="true" aria-labelledby="modal-title"` to each modal root div; add `onKeyDown` handler for `Escape` in SettingsModal and Beads modals.

3. **Replace `alert()` and `confirm()` calls with in-app UI** — `useProjectHandlers.ts` calls `alert()` 3× for session start errors; `IntelligenceSidebar.tsx` and `VoiceBrowserModal.tsx` use `confirm()` for destructive actions. Browser-native dialogs block the event loop, break Tauri's window model, are visually jarring, and cannot be styled. Fix: replace with an in-app `<ErrorDialog>` component for alerts and a styled confirmation modal for destructive confirms.

4. **Eliminate hardcoded hex colors from mobile component inline styles** — `FileBrowser.tsx` (13 hardcoded hex values), `ConnectedView.tsx`, and `HostSelector.tsx` use raw hex (`#1a1a1a`, `#333`, `#4a90d9`, etc.) in inline `style={}` objects instead of CSS variables or Tailwind tokens. These bypass the theme system entirely and will be invisible to dark/light mode switches. Fix: extract to CSS custom properties in `modernize.css` or convert to Tailwind semantic classes.

5. **Add `aria-label` to the MoreVertical and search input controls in Header** — The `MoreVertical` button (line 104, `Header.tsx`) has no `aria-label` and no `title` attribute. The search `<input>` (line 74) has no `<label>` element and no `aria-label`. Both are keyboard-reachable but meaningless to assistive technology. Fix: `aria-label="More options"` on the button; `aria-label="Search commands"` on the input.

---

## Copywriting — 2/4

### Strengths
- Empty state copy in MainApp.tsx ("No Active Threads") is specific and actionable with a sub-label directing users to add a project.
- Beads priority labels are user-friendly (P0–P4 with human descriptions, not raw integers).
- ConnectionScreen ErrorView surfaces actual network error strings rather than generic "error" text.
- Spotlight empty state ("No results found for ...") echoes the user's query — good pattern.

### Issues

- `src/renderer/components/beads/TaskDetailModal.tsx:340` — **HIGH**: Button label is "Save" — generic verb with no object. Fix: "Save Changes" or "Update Task".
- `src/renderer/components/beads/CreateTaskModal.tsx:202` — **HIGH**: "Cancel" and "Create" as a pair — "Create" is acceptable as verb-noun is implied by context, but "Cancel" should be "Discard" to signal unsaved state loss.
- `src/renderer/components/mobile/QRScanner.tsx:25` — **MEDIUM**: "Cancel" in plain `bg-gray-200` button with no context label. Fix: "Cancel Scan".
- `src/renderer/components/beads/BeadsActionsRow.tsx:27,31` — **HIGH**: Unicode HTML entities `&#10003;` (checkmark) and `&#8635;` (refresh) used as visible button labels with no surrounding text or `aria-label`. These render as bare symbols with no semantic meaning. All 10 instances across BrowserModal, BeadsActionsRow, StartDropdown, TaskStatusButton are affected.
- `src/renderer/hooks/useProjectHandlers.ts:171,247,288` — **MEDIUM**: `alert()` error messages contain stack-trace-level detail ("Please ensure Claude Code is installed and try restarting the application") but are visually indistinguishable from OS system alerts. The copy is functional but the delivery mechanism is wrong.
- `src/renderer/components/settings/SettingsModal.tsx:246` — **LOW**: H2 label is "Config" — terse branding over clarity. Users expect "Settings" to match the affordance that launched it.
- `src/renderer/App/MainApp.tsx:336` — **LOW**: Global loading state copy is bare `<p>Loading...</p>`. Missing context of what is loading.

---

## Visuals — 3/4

### Strengths
- Clear visual hierarchy in the IconBar: icon-only columns with tooltip labels on hover, active state weight differentiation.
- `ApprovalWorkflow.tsx` uses distinct color-coded risk badges (emerald/amber/orange/rose) with good visual encoding.
- `HealthHUD.tsx` uses semantic icon+color pairing (HeartPulse, Cpu, Database) with color-coded thresholds — appropriate data density for a header HUD.
- Lucide icons used consistently throughout desktop components; no mixed icon libraries detected.
- Empty state in MainApp has illustration container (MessageSquare icon) + heading + description — correct 3-tier empty state pattern.

### Issues

- `src/renderer/components/Header.tsx:104` — **HIGH**: The `MoreVertical` (kebab) button has no `aria-label`, no `title` attribute, and no visible tooltip. Icon-only interactive elements must have both. Beyond accessibility, users cannot predict what this button does.
- `src/renderer/components/beads/BrowserModal.tsx:77` — **MEDIUM**: `&#128255;` (emoji) used as a section icon in a production panel. Emoji rendering is platform-dependent and inconsistent across OS font stacks. Replace with Lucide icon.
- `src/renderer/components/beads/` — **MEDIUM**: HTML entity icons (`&#10003;`, `&#9654;`, `&#8594;`) used as action indicators across 10 instances in Beads components. No visual consistency with the Lucide icon system used elsewhere in the app. This creates a two-tier visual language inside the same sidebar section.
- `src/renderer/App/MainApp.tsx:329-337` — **LOW**: Global loading state renders a plain `<p>Loading...</p>` with no visual indicator (no spinner, no skeleton, no progress). The loading state class `empty-state` is CSS-only with no animation.
- `src/renderer/components/intelligence/IntelligenceSidebar.tsx:920` — **LOW**: Hardcoded `bg-[#0a0a0c]` as the cognitive modal background deviates from the glass-panel visual system used everywhere else. Visual inconsistency.

---

## Color — 2/4

### Strengths
- Semantic tokens defined in `index.css` and extended in `modernize.css`: `--primary`, `--destructive`, `--muted-foreground`, `--border` — correct pattern.
- Dark theme uses `#050508` (not pure black `#000000`) — aligned with best practice.
- Status colors in `ApprovalWorkflow` and `HealthHUD` use semantic Tailwind classes (`text-emerald-400`, `text-rose-400`) consistently.
- `index.css` correctly maps `--destructive` for error-level semantic color.

### Issues

- `src/renderer/components/mobile/FileBrowser.tsx:131,139,163,164,171,200,242,283` — **BLOCKER**: 13 hardcoded hex values in inline `style={}` objects including `#1a1a1a`, `#333`, `#252525`, `#4a2d2d`, `#4a90d9`, `#555`. These completely bypass the token system and will not respond to theme changes.
- `src/renderer/components/mobile/MobileApp/ConnectedView.tsx:163,175,187,189,201,230,274,275` — **HIGH**: 8+ hardcoded hex values in inline styles (`#333`, `#2d4a3e`, `#4a3a2d`, `#2d3a4a`, `#4a90d9`, `#1a1a1a`, `#444`). Same bypass issue.
- `src/renderer/components/intelligence/IntelligenceSidebar.tsx:920` and `CognitiveSearchModal.tsx:101` — **MEDIUM**: `bg-[#0a0a0c]` hardcoded in Tailwind arbitrary value brackets instead of using `--bg-codex-dark` CSS variable already defined in `modernize.css`.
- `src/renderer/components/modernize.css:50` — **MEDIUM**: `.app-container` uses `background-color: #050508` (raw hex) instead of `var(--bg-codex-dark)` which is defined 8 lines above. Defeats the token abstraction.
- `src/renderer/index.css:95-104` — **LOW**: Dark mode `--destructive` is `0 62.8% 30.6%` (HSL ~30% lightness). On a dark background this renders as a very dark red with insufficient contrast against white text. Potential WCAG contrast failure on error buttons.
- `src/renderer/components/beads/` — **LOW**: Beads CSS classes (`.beads-btn-cancel`, `.beads-btn-create`) do not use semantic tokens — their actual colors are defined in an unaudited CSS file outside Tailwind, breaking the 60/30/10 token discipline.

---

## Typography — 1/4

### Strengths
- Consistent use of `font-bold` for hierarchy markers (346 instances) and `font-medium` for secondary labels (117 instances).
- Heading copy in SettingsModal uses gradient text for visual differentiation, not just weight alone.

### Issues

- **BLOCKER**: 9 distinct arbitrary pixel font sizes in use: `text-[6px]`, `text-[7px]`, `text-[8px]`, `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-[12px]`, `text-[13px]`, `text-[15px]`. Combined with the Tailwind type scale classes (`text-xs`, `text-sm`, `text-lg`, etc.) this means the app has **15 distinct font sizes** across the component tree. The standard design system budget is 4–6. This is not a design system — it is ad-hoc sizing.
  - `text-[10px]`: 301 instances — used as the dominant label size across BeadsPanel, IntelligenceSidebar, brainstorm nodes
  - `text-[9px]`: 120 instances — used for micro-labels, below any accessible threshold at 96dpi
  - `text-[8px]`, `text-[7px]`, `text-[6px]`: 23+1+1 instances — these sizes are illegible without OS-level zoom and fail WCAG 1.4.4 Resize Text.
- **BLOCKER**: `text-base` (16px) is used zero times in components. Body text has no declared minimum size. The de facto body size across the app appears to be `text-sm` (14px) or `text-[11px]`. WCAG 2.2 and mobile best practice requires minimum 16px body text on mobile.
- `src/renderer/components/intelligence/` — **HIGH**: Brainstorm node body copy is `text-[9px]` (`brainstorm-node-body`). This is 9px — below any reasonable legibility floor. Fix: minimum `text-xs` (12px).
- `src/renderer/components/beads/` — **HIGH**: Beads panel uses `text-[10px]` as primary content size throughout, with `text-[9px]` for secondary labels. The entire panel is operating below the readable baseline.
- No `line-height` / `leading-` classes on body paragraphs — body text inherits browser defaults (typically 1.2), not the recommended 1.5 for readability.
- `src/renderer/components/sidebar/SidebarContent.tsx` — **MEDIUM**: Section headers use `text-[10px] font-bold uppercase tracking-widest` — this is a common pattern but at 10px uppercase tracking is helping only marginally; still sub-threshold for body.

---

## Spacing — 2/4

### Strengths
- Core layout uses standard Tailwind spacing scale (`p-4`, `p-6`, `gap-2`, `gap-4`) throughout MainApp, Header, SettingsModal sidebar, and IconBar.
- IconBar padding `py-6`, `px-2`, `gap-2` is consistent and within 8px grid.
- SettingsModal uses `p-6` for content areas — consistent.
- Mobile CSS uses `env(safe-area-inset-*)` correctly in 10+ places.

### Issues

- **HIGH**: Widespread use of arbitrary spacing values in component files. Notable patterns:
  - `text-[10px]` / `text-[9px]` as spacing proxies (see Typography)
  - `p-1.5`, `p-2.5`, `py-0.5`, `py-1.5` — fractional Tailwind steps that are not 8px-grid multiples. `p-1.5` = 6px, `py-0.5` = 2px. These are acceptable as micro-spacing but their prevalence (across buttons, badges, voice controls) suggests no spacing scale discipline.
  - `index.css:197` `.spotlight-container` uses inline `box-shadow: 0 0 80px rgba(0,0,0,0.8)` — magic number shadow not from a token.
- `src/renderer/components/intelligence/IntelligenceSidebar.tsx` — **MEDIUM**: 1042-line component with spacing applied inline at every nesting level — no evidence of a shared spacing token or constant. Maintenance hazard.
- `src/renderer/styles.css:248` — **MEDIUM**: `.extension-browser-modal` uses `w-[90vw] max-w-5xl h-[85vh]` — arbitrary viewport units rather than tokens. Acceptable for modal sizing but inconsistent with the `max-w-4xl` used in SettingsModal (same conceptual component type).
- `src/renderer/components/beads/TaskDetailModal.tsx` and `CreateTaskModal.tsx` — **MEDIUM**: Modal layout uses class-based CSS (`beads-modal`, `beads-modal-body`) rather than Tailwind. The actual spacing values are in an unaudited CSS file, making spacing audit incomplete for the Beads subsystem.
- `src/renderer/components/sidebar/` — **LOW**: Sidebar resize handle uses `w-[1px]` (Tailwind arbitrary value for a 1px element) — acceptable but inconsistent with using `h-px` convention elsewhere.

---

## Experience Design — 2/4

### Strengths
- `ErrorBoundary` is applied at the application root (`main.tsx:36`) and around every `Terminal` instance in desktop mode — good coverage for the most crash-prone surface.
- `useFocusTrap` exists and is correctly applied in `SettingsModal` and `DeleteConfirmModal` for Tab cycling.
- Loading states exist in: `BeadsPanel` (with `role="status" aria-live="polite"`), `ClaudeMdEditor`, `TaskDetailModal`.
- `VirtualizedProjectList` exists and correctly skips virtualization for small lists.
- Mobile safe area insets implemented in `mobile.css` across 10+ relevant selectors.
- `prefers-reduced-motion` media query exists in `mobile.css:471` — at least one CSS layer respects it.
- `DeleteConfirmModal` uses a proper modal pattern with focus trap, backdrop click, and Cancel/Confirm buttons.
- Sidebar collapsed state is persisted (via `useViewState` hook) with width and collapse boolean.

### Issues

- **BLOCKER**: `useProjectHandlers.ts:171,247,288` — Three `alert()` calls for session start failures. Browser `alert()` is synchronous, blocks the JS thread, uses OS-native UI that cannot be dismissed with Tauri's window model cleanly, and has no styling. This is a critical UX regression in a desktop app context. Fix: render an in-app `<ErrorDialog>` component.

- **BLOCKER**: `SettingsModal`, `CreateTaskModal`, `TaskDetailModal` have no `role="dialog"` or `aria-modal="true"`. Screen readers (NVDA, VoiceOver) do not enter modal context, allowing the user to tab into background content. `useFocusTrap` prevents Tab cycling out but ARIA modal semantics are still missing — the two concerns are separate.

- **BLOCKER**: `SettingsModal` has no Escape key handler. The modal closes only by clicking the backdrop or a close button. Keyboard users who open Settings with keyboard are trapped (the focus trap works, but Escape — the expected escape hatch per WCAG 2.1 SC 1.4.13 — is not wired). `useFocusTrap` handles Tab only.

- `src/renderer/components/VoiceBrowserModal.tsx:291` — **HIGH**: `confirm('Delete this voice clone?')` is a native browser confirm dialog for a destructive action. Per best practice, destructive irreversible actions require an in-app modal with typed confirmation or at minimum a styled confirmation dialog. Fix: replace with a `<DeleteConfirmModal>`-style component.

- `src/renderer/components/intelligence/IntelligenceSidebar.tsx:483` — **HIGH**: `confirm('Are you sure you want to apply this initialization?...')` — same native confirm issue in a complex interaction flow. This is additionally problematic as initialization is an irreversible file system operation.

- `src/renderer/hooks/useProjectHandlers.ts` — **HIGH**: Three separate `alert()` calls for the same error condition ("Failed to start Claude session") suggest no centralized error reporting system exists. No toast system is present in the codebase. Errors surfaced to users are either bare `alert()` or logged to `console.error` silently. Fix: implement a toast/notification context.

- `src/renderer/components/Header.tsx:74` — **HIGH**: Search `<input>` with `placeholder="Search commands..."` has no `<label>` element and no `aria-label` attribute. Placeholder text is not a substitute for a label (WCAG 1.3.1 Info and Relationships). Screen readers announce "edit text" with no description.

- `src/renderer/components/beads/TaskDetailModal.tsx` and `CreateTaskModal.tsx` — **MEDIUM**: Close button is the Unicode character `×` (`&times;`) without an `aria-label`. Screen readers announce "times" or the multiplication sign rather than "Close". Fix: add `aria-label="Close"` to `.beads-modal-close` button.

- `src/renderer/components/App/MainApp.tsx:332` — **MEDIUM**: The app-level loading state has `role="status"` and `aria-live="polite"` — correctly implemented. However, the content is only `<p>Loading...</p>`. No spinner, no skeleton screen, no indication of what is being loaded. Minimum: add a spinner or skeleton.

- `src/renderer/styles/mobile.css:471` — **MEDIUM**: `prefers-reduced-motion` is honored only in `mobile.css`. The desktop components (e.g., `animate-gradient` in `index.css:157`, `spotlight-slide-up` in `index.css:207`, `brainstorm-card` hover transform in `index.css:373`) have no `prefers-reduced-motion` guard. These animations run unconditionally even when the OS has requested reduced motion.

- `src/renderer/components/settings/PermissionsSettings.tsx:63` — **LOW**: Button label is `x` (single character) for removing a custom tool. No `aria-label`. Fix: `aria-label="Remove tool"`.

---

## Files Audited

- `src/renderer/App/MainApp.tsx`
- `src/renderer/components/Header.tsx`
- `src/renderer/components/TitleBar.tsx`
- `src/renderer/components/IconBar.tsx`
- `src/renderer/components/SettingsModal.tsx`
- `src/renderer/components/sidebar/Sidebar.tsx`
- `src/renderer/components/beads/BeadsPanel.tsx`
- `src/renderer/components/beads/TaskDetailModal.tsx`
- `src/renderer/components/beads/CreateTaskModal.tsx`
- `src/renderer/components/beads/BrowserModal.tsx`
- `src/renderer/components/beads/BeadsActionsRow.tsx`
- `src/renderer/components/beads/TaskStatusButton.tsx`
- `src/renderer/components/beads/StartDropdown.tsx`
- `src/renderer/components/ConnectionScreen/ConnectionScreen.tsx`
- `src/renderer/components/ConnectionScreen/views/WelcomeView.tsx`
- `src/renderer/components/telemetry/HealthHUD.tsx`
- `src/renderer/components/orchestration/ApprovalWorkflow.tsx`
- `src/renderer/components/intelligence/IntelligenceSidebar.tsx` (scanned)
- `src/renderer/components/mobile/FileBrowser.tsx` (scanned)
- `src/renderer/components/mobile/MobileApp/ConnectedView.tsx` (scanned)
- `src/renderer/components/sidebar/DeleteConfirmModal.tsx`
- `src/renderer/hooks/useFocusTrap.ts`
- `src/renderer/hooks/useProjectHandlers.ts`
- `src/renderer/index.css`
- `src/renderer/modernize.css`
- `src/renderer/styles.css`
- `src/renderer/themes/definitions/dark.ts`
