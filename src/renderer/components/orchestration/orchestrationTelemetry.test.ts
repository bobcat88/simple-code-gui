import { describe, expect, it } from 'vitest';
import {
  estimateAgentActionCost,
  summarizeAgentActionCosts,
} from './orchestrationTelemetry';
import type { AgentAction } from './types';

const action = (metadata?: Record<string, unknown>): AgentAction => ({
  id: Math.random().toString(36),
  agentId: 'agent-1',
  agentName: 'Builder',
  type: 'command',
  message: 'Run tests and repair coverage thresholds',
  timestamp: 1710000000000,
  metadata,
});

describe('orchestrationTelemetry', () => {
  it('uses provider token and cost metadata when present', () => {
    expect(
      estimateAgentActionCost(
        action({
          input_tokens: '120',
          outputTokens: 45,
          cost_estimate: '0.031',
        })
      )
    ).toEqual({
      inputTokens: 120,
      outputTokens: 45,
      totalTokens: 165,
      costEstimate: 0.031,
    });
  });

  it('estimates missing token/cost telemetry from action text', () => {
    const sample = estimateAgentActionCost(action());

    expect(sample.inputTokens).toBeGreaterThan(0);
    expect(sample.outputTokens).toBe(0);
    expect(sample.costEstimate).toBeGreaterThan(0);
  });

  it('summarizes orchestration action spend', () => {
    const summary = summarizeAgentActionCosts([
      action({ inputTokens: 10, outputTokens: 5, cost: 0.002 }),
      action({ inputTokens: 4, outputTokens: 1, cost: 0.001 }),
    ]);

    expect(summary).toMatchObject({
      actionCount: 2,
      inputTokens: 14,
      outputTokens: 6,
      totalTokens: 20,
      costEstimate: 0.003,
    });
  });
});
