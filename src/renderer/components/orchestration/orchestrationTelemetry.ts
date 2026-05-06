import type { AgentAction } from './types';

export interface AgentCostSample {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costEstimate: number;
}

export interface AgentCostSummary extends AgentCostSample {
  actionCount: number;
}

const INPUT_KEYS = [
  'inputTokens',
  'input_tokens',
  'prompt_tokens',
  'promptTokens',
];
const OUTPUT_KEYS = [
  'outputTokens',
  'output_tokens',
  'completion_tokens',
  'completionTokens',
];
const COST_KEYS = ['costEstimate', 'cost_estimate', 'cost', 'cost_est'];
const DEFAULT_COST_PER_TOKEN = 0.000002;

function metadataNumber(
  metadata: Record<string, unknown> | undefined,
  keys: string[]
): number | undefined {
  if (!metadata) return undefined;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

export function estimateAgentActionCost(action: AgentAction): AgentCostSample {
  const estimatedInput = Math.ceil(
    `${action.agentName} ${action.message}`.length / 4
  );
  const inputTokens =
    metadataNumber(action.metadata, INPUT_KEYS) ?? estimatedInput;
  const outputTokens = metadataNumber(action.metadata, OUTPUT_KEYS) ?? 0;
  const totalTokens = inputTokens + outputTokens;
  const costEstimate =
    metadataNumber(action.metadata, COST_KEYS) ??
    Number((totalTokens * DEFAULT_COST_PER_TOKEN).toFixed(6));

  return { inputTokens, outputTokens, totalTokens, costEstimate };
}

export function summarizeAgentActionCosts(
  actions: AgentAction[]
): AgentCostSummary {
  return actions.reduce<AgentCostSummary>(
    (summary, action) => {
      const sample = estimateAgentActionCost(action);
      summary.inputTokens += sample.inputTokens;
      summary.outputTokens += sample.outputTokens;
      summary.totalTokens += sample.totalTokens;
      summary.costEstimate = Number(
        (summary.costEstimate + sample.costEstimate).toFixed(6)
      );
      summary.actionCount += 1;
      return summary;
    },
    {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costEstimate: 0,
      actionCount: 0,
    }
  );
}
