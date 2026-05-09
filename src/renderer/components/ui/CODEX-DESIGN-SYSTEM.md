# Codex Design System

Reference for the component library at `src/renderer/components/ui/`. Modeled on OpenAI Codex Desktop — minimal chrome, monospace font, pure motion.

---

## 1. Philosophy

Codex Desktop is a developer tool. Its UI gets out of the way.

- **Monospace everywhere** — `ui-monospace` for both UI and code. Same font, different size. This is the signature developer-tool feel.
- **No glow, no neon** — accent is a plain blue (`#0169CC`), not a purple gradient.
- **Minimal chrome** — no borders around interactive elements unless needed for affordance. Background contrast carries the hierarchy.
- **Pure CSS motion** — Codex itself uses zero JS animation libraries. We use framer-motion for convenience but follow the same constraints: tween only, no spring, compositor-safe props only.
- **Translucent sidebar** — `backdrop-filter: blur(12px) saturate(180%)` on the sidebar panel gives depth without adding visual weight.

---

## 2. Exact Codex Tokens

Reverse-engineered from the Codex Desktop binary (2025).

### Dark preset ("Codex")

| Token | Value |
|-------|-------|
| Background | `#111111` |
| Foreground | `#FCFCFC` |
| Accent | `#0169CC` |
| Font | `ui-monospace` |

### Light preset ("One")

| Token | Value |
|-------|-------|
| Background | `#FAFAFA` |
| Foreground | `#383A42` |
| Accent | `#526FFF` |
| Font | `ui-monospace` (Helvetica in some views) |

**Contrast notes:**
- Dark: `#FCFCFC` on `#111111` → ~19:1 (exceeds WCAG AAA)
- Light: `#383A42` on `#FAFAFA` → ~10:1 (exceeds WCAG AAA)
- Dark accent on dark bg: `#0169CC` on `#111111` → ~4.8:1 (WCAG AA)

---

## 3. Token Reference

All tokens are CSS custom properties defined in `tokens.css`.

### Color — Dark

| Variable | Value | Usage |
|----------|-------|-------|
| `--bg` | `#111111` | App background |
| `--fg` | `#FCFCFC` | Primary text |
| `--accent` | `#0169CC` | Interactive highlight, focus ring |
| `--accent-hover` | `#0178E8` | Accent on hover |
| `--accent-subtle` | `rgba(1,105,204,0.12)` | Tinted badge/chip backgrounds |
| `--surface-0` | `#111111` | Root background |
| `--surface-1` | `#1c1c1c` | Sidebar, panels |
| `--surface-2` | `#262626` | Cards, popovers |
| `--surface-3` | `#2e2e2e` | Hover states, nested cards |
| `--border-subtle` | `rgba(255,255,255,0.04)` | Dividers |
| `--border-default` | `rgba(255,255,255,0.10)` | Component borders |
| `--border-strong` | `rgba(255,255,255,0.20)` | Focus rings, active borders |
| `--text-primary` | `#FCFCFC` | Body text |
| `--text-secondary` | 60% white | Captions, labels |
| `--text-tertiary` | 38% white | Placeholders |
| `--text-disabled` | 24% white | Disabled state |

### Color — Light

| Variable | Value |
|----------|-------|
| `--bg` | `#FAFAFA` |
| `--fg` | `#383A42` |
| `--accent` | `#526FFF` |
| `--surface-0` | `#FAFAFA` |
| `--surface-1` | `#F0F0F0` |
| `--surface-2` | `#E8E8E8` |
| `--surface-3` | `#DCDCDC` |

### Typography

| Variable | Value |
|----------|-------|
| `--font-ui` | `ui-monospace, "SF Mono", "Fira Code", monospace` |
| `--font-mono` | `ui-monospace, "SF Mono", "Fira Code", monospace` |

Both variables resolve to the same stack. Using a single font for UI and code is intentional — it's the signature developer-tool feel.

### Spacing / Shape

| Variable | Value |
|----------|-------|
| `--radius-xs` | `3px` |
| `--radius-sm` | `4px` |
| `--radius-md` | `6px` |
| `--radius-lg` | `8px` |
| `--radius-xl` | `12px` |

### Motion

| Variable | Value |
|----------|-------|
| `--duration-fast` | `100ms` |
| `--duration-normal` | `150ms` |
| `--ease-out` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--transition-hover` | `background-color 100ms cubic-bezier(0.4,0,0.2,1)` |
| `--transition-panel` | `opacity 150ms ..., transform 150ms ...` |
| `--transition-modal` | `opacity 150ms ..., transform 150ms ...` |
| `--sidebar-blur` | `blur(12px) saturate(180%)` |

---

## 4. Animation System

### The 5 Rules

1. **No spring, no bounce** — `type: 'tween'` everywhere. Springs feel playful; Codex feels precise.
2. **No layout prop animation** — never animate `width`, `height`, `padding`, or `margin`. These force layout recalc and stutter.
3. **No `transition-all`** — always specify the exact property. `transition-all` animates layout props when classes change.
4. **Ease-out only** — `cubic-bezier(0.4, 0, 0.2, 1)` (Material Design standard ease-out). Instant start, soft landing.
5. **≤200ms** — hover/tap: 100ms, panels/dropdowns: 150ms, modals: 150–200ms max.

### Compositor-safe properties only

Animating these properties never triggers layout or paint — only compositing:
- `opacity`
- `transform` (translate, scale, rotate)

Acceptable for occasional use:
- `background-color` (paint, no layout — fine for hover states)

Never animate:
- `width`, `height`, `max-height`, `padding`, `margin`, `border-width`
- `top`, `left`, `right`, `bottom` (use `transform: translate` instead)
- `font-size`, `line-height`

### Presets — `animations.ts`

All presets are `Variants` objects for framer-motion. Import from `@/components/ui`.

#### `fadeIn` / `fadeOut`
Opacity only, 100ms. Use for: inline content appearing, status changes.

```tsx
<motion.div variants={fadeIn} initial="initial" animate="animate" />
```

#### `slideDown` / `slideUp`
Opacity + 4px Y translate, 150ms. Use for: dropdowns, tooltips, context menus.

```tsx
<motion.div variants={slideDown} initial="initial" animate="animate" exit="exit" />
```

#### `scaleIn` / `scaleOut`
Opacity + scale from 0.96, 150ms. Use for: popovers, selection overlays.

#### `modalVariants`
Same as scaleIn/Out but with explicit `exit`. Use with `AnimatePresence`:

```tsx
<AnimatePresence>
  {open && (
    <motion.div variants={modalVariants} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  )}
</AnimatePresence>
```

#### `panelVariants`
Opacity + 8px X translate, 150ms. Use for: sidebar panel appear/disappear. Pair with `will-change: transform` on the element.

```tsx
<motion.aside style={{ willChange: 'transform' }} variants={panelVariants} initial="initial" animate="animate" exit="exit" />
```

#### `tapScale`
`whileTap: { scale: 0.97 }`. Spread onto any `motion.button`.

```tsx
<motion.button {...tapScale}>Click</motion.button>
```

#### `hoverScale`
`whileHover: { scale: 1.02 }`. Use sparingly — only on large clickable surfaces, not icon buttons.

#### `transition(duration, delay?)`
Helper to build a transition object:

```tsx
transition(DURATIONS.normal)          // { type: 'tween', duration: 0.15, ease: [...] }
transition(DURATIONS.fast, 0.05)      // with 50ms delay
```

#### `DURATIONS` / `EASE`

```ts
DURATIONS.fast    // 0.1
DURATIONS.normal  // 0.15
DURATIONS.slow    // 0.2

EASE              // [0.4, 0, 0.2, 1]
```

---

## 5. Component Guide

### Button

**DO:**
```tsx
<Button variant="default">Run</Button>
<Button variant="ghost">Cancel</Button>
<Button variant="destructive">Delete</Button>
```

**DON'T:**
- Add `transition-all` via className
- Use purple/neon colors via inline style
- Animate width or padding
- Stack multiple `default` variant buttons — one primary action per view

### IconButton

**DO:**
- Keep tooltips to a single line
- Use `slideDown` variant for tooltip appear
- Use `tapScale` for press feedback
- Always provide `label` for accessibility

**DON'T:**
- Multi-line tooltip content
- Animate the icon itself (only the container)
- Color-code icons when active — use opacity/weight instead

### Badge

**DO:**
```tsx
<Badge variant="accent">beta</Badge>
<Badge variant="success">passing</Badge>
<Badge variant="error">2 errors</Badge>
```

**DON'T:**
- Use as a button (no onClick on Badge)
- Animate size
- Add shadows

### Separator

Purely decorative. No motion.

```tsx
<Separator />
<Separator orientation="vertical" className="h-4" />
```

### Tooltip

- Single-line content only
- Appear: `slideDown` variant, 150ms
- `--transition-panel` for CSS fallback

```tsx
<Tooltip content="New session" side="right">
  <IconButton label="New session"><PlusIcon size={16} /></IconButton>
</Tooltip>
```

### Panel

Sidebar/drawer panel:
- Apply `style={{ backdropFilter: 'var(--sidebar-blur)' }}` for translucent variant
- Apply `style={{ willChange: 'transform' }}` when using `panelVariants`
- Background: `var(--surface-1)`

```tsx
<Panel border padding>...</Panel>
```

### StatusDot

- No animation for persistent states (idle, active)
- Pulse animation only for "connecting" or "loading" states — opacity only, never scale

```tsx
<StatusDot state="running" />
<StatusDot state="error" />
<StatusDot state="idle" />
```

---

## 6. Migration Guide

### Header.tsx

Current issues:
- Inline stats bar (tokens, costs, warnings) adds ~40px vertical space
- Uses `transition-all` on button hover classes
- Neon/purple accent colors

Changes:
1. Remove stats bar from Header. Move to a collapsed status bar at the window bottom or a hover-reveal popover.
2. Replace `transition-all duration-200` with `style={{ transition: 'var(--transition-hover)' }}` on all interactive elements.
3. Drop `hover:bg-white/5 hover:bg-white/10` opacity chains — use `var(--surface-2)` on hover via CSS.

```tsx
// Before
<button className="transition-all duration-200 hover:bg-white/10 text-purple-400">

// After
<motion.button style={{ transition: 'var(--transition-hover)' }} {...tapScale}>
```

Target header structure:
```tsx
<header className="h-10 flex items-center px-3 gap-2 bg-[--surface-1] border-b border-[--border-subtle]" data-tauri-drag-region>
  <span className="text-xs text-[--text-secondary] select-none">simple-code</span>
  <Separator orientation="vertical" className="h-4" />
  <SessionSwitcher />
  <div className="ml-auto flex items-center gap-1">
    <IconButton label="Search"><SearchIcon size={16} /></IconButton>
    <IconButton label="Settings"><SettingsIcon size={16} /></IconButton>
  </div>
</header>
```

### IconBar.tsx

Current issues:
- Tooltip content may be multi-line
- Tooltip appears without animation or with wrong easing
- Icons color-coded with neon when active

Changes:
1. Enforce single-line tooltip content: truncate with `max-w-[160px] truncate`.
2. Wrap tooltip with `AnimatePresence` and apply `slideDown` variant.
3. Active state: `data-active` attribute + CSS `[data-active=true]` selector, not color classes.

```tsx
<AnimatePresence>
  {tooltipOpen && (
    <motion.div variants={slideDown} initial="initial" animate="animate" exit="exit">
      {label}
    </motion.div>
  )}
</AnimatePresence>
```

### TitleBar.tsx

Current issues:
- Separate TitleBar component adds ~32px vertical space
- Redundant with Header for window drag region

Changes:
1. Merge TitleBar content into the first row of Header.
2. Delete `TitleBar.tsx`.
3. Add `data-tauri-drag-region` to Header element.
4. Net saving: ~40px vertical space reclaimed for the content area.

### General — color migration

Replace all ad-hoc opacity color chains with tokens:

| Before | After |
|--------|-------|
| `bg-white/5` | `bg-[--surface-1]` |
| `bg-white/10` | `bg-[--surface-2]` |
| `bg-white/20` | `bg-[--surface-3]` |
| `text-white/60` | `text-[--text-secondary]` |
| `text-white/38` | `text-[--text-tertiary]` |
| Purple/neon accent | `text-[--accent]` or `bg-[--accent]` |
| `transition-all` | `transition: var(--transition-hover)` or `var(--transition-panel)` |
| `shadow-*` with glow | remove |

---

## 7. Tailwind 4 Integration

Import `tokens.css` in your global stylesheet entry point:

```css
@import "tailwindcss";
@import "./components/ui/tokens.css";

@theme {
  --color-bg: var(--bg);
  --color-fg: var(--fg);
  --color-accent: var(--accent);
  --color-surface-0: var(--surface-0);
  --color-surface-1: var(--surface-1);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);
  --color-border: var(--border-default);
  --color-text: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --font-family-ui: var(--font-ui);
  --font-family-mono: var(--font-mono);
}
```

This makes all tokens available as Tailwind utility classes: `bg-surface-1`, `text-accent`, `font-ui`, etc.

For arbitrary values in JSX without `@theme` wiring:
```tsx
className="bg-[--surface-1] border-[--border-subtle] text-[--text-secondary]"
```

**Do not** redefine color values in `tailwind.config.ts` — let them resolve through the CSS variable chain so theme switching (`.dark` / `.light`) works at runtime without a JS rebuild.
