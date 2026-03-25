export const COMMON_TOOLS = [
  { label: 'Read', value: 'Read' },
  { label: 'Write', value: 'Write' },
  { label: 'Edit', value: 'Edit' },
  { label: 'MultiEdit', value: 'MultiEdit' },
  { label: 'Grep', value: 'Grep' },
  { label: 'Glob', value: 'Glob' },
  { label: 'LS', value: 'LS' },
  { label: 'WebFetch', value: 'WebFetch' },
  { label: 'WebSearch', value: 'WebSearch' },
  { label: 'Questions', value: 'AskUserQuestion' },
  { label: 'Task', value: 'Task' },
  { label: 'TodoWrite', value: 'TodoWrite' },
  { label: 'Git', value: 'Bash(git:*)' },
  { label: 'npm', value: 'Bash(npm:*)' },
  { label: 'All Bash', value: 'Bash' },
]

export const PERMISSION_MODES = [
  { label: 'Default', value: 'default', desc: 'Ask for permissions' },
  { label: 'Accept Edits', value: 'acceptEdits', desc: 'Auto-accept edits' },
  { label: 'Plan', value: 'plan', desc: 'Approve plans first' },
  { label: 'Auto', value: 'auto', desc: 'Auto permissions' },
  { label: "Don't Ask", value: 'dontAsk', desc: 'Skip prompts' },
  { label: 'Bypass All', value: 'bypassPermissions', desc: 'Skip all checks' },
]

export const API_SESSION_MODES = [
  { label: 'Existing', value: 'existing', desc: 'Use existing session' },
  { label: 'New (Keep)', value: 'new-keep', desc: 'New session, keep open' },
  { label: 'New (Close)', value: 'new-close', desc: 'New session, auto-close' },
]

export const API_MODELS = [
  { label: 'Default', value: 'default', desc: 'Use default model' },
  { label: 'Opus', value: 'opus', desc: 'Most capable' },
  { label: 'Sonnet', value: 'sonnet', desc: 'Balanced' },
  { label: 'Haiku', value: 'haiku', desc: 'Fast & cheap' },
]

export const PROJECT_COLORS = [
  { name: 'None', value: undefined },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
]
