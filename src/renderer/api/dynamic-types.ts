// Centralized escape hatch for legacy IPC surfaces that still need runtime audit.
// biome-ignore lint/suspicious/noExplicitAny: tracks remaining dynamic API debt outside api/types.ts.
export type DynamicApiValue = any;
