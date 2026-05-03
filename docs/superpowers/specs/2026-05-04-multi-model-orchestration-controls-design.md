# Multi-Model Orchestration Controls

**Date:** 2026-05-04  
**Issue:** simple-code-gui-5ywo  
**Phase:** 38

## Summary

Add a floating orchestration panel to `SwarmCognitiveHub` that lets users switch the AI provider and model for each active swarm agent independently, with changes applied immediately via `setPtyBackend`.

## Scope

- Per-agent provider switching (claude | gemini | codex | opencode | aider)
- Per-provider model selection (model options change based on selected provider)
- Changes apply immediately to running agents when "Apply to Swarm" is clicked
- Agents are discovered dynamically from `onAgentStatus` events

Out of scope: global/bulk model switching, per-agent system prompt editing, agent creation/removal.

## Architecture

### New hook: `useSwarmAgents`

Tracks active agents by subscribing to `api.onAgentStatus`. Maintains a map of `agentId → { name, status, provider, model }`. Agent names derived from `agentId` (slug or display name). Agent dot color derived from stable index in the map.

```ts
interface SwarmAgent {
  id: string
  name: string
  status: string
  provider: BackendId
  model: string
}
```

### New component: `OrchestrationPanel`

Floating side panel rendered inside `SwarmCognitiveHub`'s main viewport div. Slides in from the right edge when open, hidden otherwise. Triggered by a FAB (⚙ icon) anchored bottom-right of the viewport.

**Provider model map** (static constant):

```ts
const PROVIDER_MODELS: Record<BackendId, string[]> = {
  claude:    ['default', 'opus', 'sonnet', 'haiku'],
  gemini:    ['default', 'pro', 'flash'],
  codex:     ['default'],
  opencode:  ['default'],
  aider:     ['default'],
}
```

**Panel layout:**

```
┌─────────────────────┐
│ ⚙ Orchestration  ✕  │
├─────────────────────┤
│ ● Alpha             │
│   Provider: [Claude]│
│   Model:   [Opus]   │
├─────────────────────┤
│ ● Beta              │
│   Provider: [Gemini]│
│   Model:   [Flash]  │
├─────────────────────┤
│  [ Apply to Swarm ] │
└─────────────────────┘
```

### Apply flow

1. User clicks "Apply to Swarm"
2. For each agent where provider changed: call `api.setPtyBackend(agentId, newProvider)`
3. PTY is recreated internally by backend; new model flag passed via existing session restart logic
4. `onPtyRecreated` fires → hook updates agent's current provider/model state

### Model passing on PTY recreate

`setPtyBackend` recreates the PTY session. The model is passed as a session-start flag. When the provider is `claude`, the selected model maps to the `--model` flag. No separate live model-switch IPC needed — model is baked into the new session.

## Components

| File | Role |
|------|------|
| `src/renderer/hooks/useSwarmAgents.ts` | New hook — tracks active agents via `onAgentStatus` |
| `src/renderer/components/intelligence/OrchestrationPanel.tsx` | New component — floating panel with agent rows |
| `src/renderer/components/intelligence/SwarmCognitiveHub.tsx` | Modified — adds FAB + OrchestrationPanel |

## Styling

Follows Toxic Glow aesthetic: `codex-neon` (#ccff00) accents, `bg-black/80 backdrop-blur-md` panel background, `border-codex-neon/30` borders, agent dot colors from a fixed palette (index-based), `animate-in slide-in-from-right-4` panel open animation.

## Error handling

- `setPtyBackend` is optional on `ExtendedApi` — gate calls with `api.setPtyBackend?.(...)`. If unavailable, disable "Apply" button with tooltip "Backend switching not available".
- If no agents are active, panel shows an empty state: "No active agents detected".
- Apply errors are caught and shown as a brief inline error message below the apply button.

## Testing

- `useSwarmAgents` hook: unit test agent discovery from mocked `onAgentStatus` events, color assignment stability, provider/model state updates.
- `OrchestrationPanel`: renders agent rows, model options change on provider switch, apply button disabled when no changes, calls `setPtyBackend` with correct args on apply.
