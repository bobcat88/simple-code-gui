#![allow(dead_code)]

use std::collections::BTreeMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

#[derive(Debug, Default)]
pub struct OptimizationMetrics {
    events: Mutex<Vec<OptimizationMetricEvent>>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizationMetricEvent {
    pub session_id: Option<String>,
    pub provider: String,
    pub raw_tokens: u64,
    pub optimized_tokens: u64,
    pub saved_tokens: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub compressions: u64,
    pub reasoning_requests: u64,
    pub fim_requests: u64,
    pub semantic_hits: u64,
    pub semantic_misses: u64,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizationStats {
    pub provider: Option<String>,
    pub raw_tokens: u64,
    pub optimized_tokens: u64,
    pub saved_tokens: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub compressions: u64,
    pub reasoning_requests: u64,
    pub fim_requests: u64,
    pub semantic_hits: u64,
    pub semantic_misses: u64,
    pub transaction_count: u64,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizationStatsResponse {
    pub aggregate: OptimizationStats,
    pub session: OptimizationStats,
    pub provider_breakdown: Vec<OptimizationStats>,
}

impl OptimizationMetrics {
    pub fn record_cache_hit(&self) {
        self.record_event(OptimizationMetricEvent {
            cache_hits: 1,
            provider: "unknown".to_string(),
            ..Default::default()
        });
    }

    pub fn record_cache_miss(&self) {
        self.record_event(OptimizationMetricEvent {
            cache_misses: 1,
            provider: "unknown".to_string(),
            ..Default::default()
        });
    }

    pub fn record_compression(&self) {
        self.record_event(OptimizationMetricEvent {
            compressions: 1,
            provider: "unknown".to_string(),
            ..Default::default()
        });
    }

    pub fn record_semantic_hit(&self, provider: &str) {
        self.record_event(OptimizationMetricEvent {
            semantic_hits: 1,
            provider: provider.to_string(),
            ..Default::default()
        });
    }

    pub fn record_semantic_miss(&self, provider: &str) {
        self.record_event(OptimizationMetricEvent {
            semantic_misses: 1,
            provider: provider.to_string(),
            ..Default::default()
        });
    }

    pub fn record_event(&self, event: OptimizationMetricEvent) {
        if let Ok(mut events) = self.events.lock() {
            events.push(event);
        }
    }

    pub fn snapshot(&self) -> OptimizationStats {
        let events = self.events.lock().unwrap_or_else(|e| e.into_inner());
        aggregate_events(&events, None, None)
    }

    pub fn stats(&self, session_id: Option<&str>) -> OptimizationStatsResponse {
        let events = self.events.lock().unwrap_or_else(|e| e.into_inner());
        let session = aggregate_events(&events, session_id, None);
        let aggregate = aggregate_events(&events, None, None);
        let mut providers = BTreeMap::new();
        for event in events.iter().filter(|event| {
            session_id
                .map(|session_id| event.session_id.as_deref() == Some(session_id))
                .unwrap_or(true)
        }) {
            providers.insert(event.provider.clone(), ());
        }
        let provider_breakdown = providers
            .keys()
            .map(|provider| aggregate_events(&events, session_id, Some(provider.as_str())))
            .collect();

        OptimizationStatsResponse {
            aggregate,
            session,
            provider_breakdown,
        }
    }
}

impl OptimizationStatsResponse {
    pub fn with_live_counters(mut self, live: OptimizationStatsResponse) -> Self {
        self.aggregate.add_counters_from(&live.aggregate);
        self.session.add_counters_from(&live.session);

        for live_provider in live.provider_breakdown {
            if let Some(provider) = live_provider.provider.as_deref() {
                if let Some(existing) = self
                    .provider_breakdown
                    .iter_mut()
                    .find(|stats| stats.provider.as_deref() == Some(provider))
                {
                    existing.add_counters_from(&live_provider);
                    continue;
                }
            }
            self.provider_breakdown
                .push(live_provider.without_token_totals());
        }

        self
    }
}

impl OptimizationStats {
    fn add_counters_from(&mut self, counters: &OptimizationStats) {
        self.cache_hits += counters.cache_hits;
        self.cache_misses += counters.cache_misses;
        self.compressions += counters.compressions;
        self.reasoning_requests += counters.reasoning_requests;
        self.fim_requests += counters.fim_requests;
        self.semantic_hits += counters.semantic_hits;
        self.semantic_misses += counters.semantic_misses;
    }

    fn without_token_totals(mut self) -> Self {
        self.raw_tokens = 0;
        self.optimized_tokens = 0;
        self.saved_tokens = 0;
        self.transaction_count = 0;
        self
    }
}

fn aggregate_events(
    events: &[OptimizationMetricEvent],
    session_id: Option<&str>,
    provider: Option<&str>,
) -> OptimizationStats {
    let mut stats = OptimizationStats {
        provider: provider.map(str::to_string),
        ..Default::default()
    };

    for event in events.iter().filter(|event| {
        session_id
            .map(|session_id| event.session_id.as_deref() == Some(session_id))
            .unwrap_or(true)
            && provider
                .map(|provider| event.provider == provider)
                .unwrap_or(true)
    }) {
        stats.raw_tokens += event.raw_tokens;
        stats.optimized_tokens += event.optimized_tokens;
        stats.saved_tokens += event.saved_tokens;
        stats.cache_hits += event.cache_hits;
        stats.cache_misses += event.cache_misses;
        stats.compressions += event.compressions;
        stats.reasoning_requests += event.reasoning_requests;
        stats.fim_requests += event.fim_requests;
        stats.semantic_hits += event.semantic_hits;
        stats.semantic_misses += event.semantic_misses;
        stats.transaction_count += 1;
    }

    stats
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn records_optimization_events() {
        let metrics = OptimizationMetrics::default();

        metrics.record_cache_hit();
        metrics.record_cache_miss();
        metrics.record_compression();

        assert_eq!(
            metrics.snapshot(),
            OptimizationStats {
                provider: None,
                raw_tokens: 0,
                optimized_tokens: 0,
                saved_tokens: 0,
                cache_hits: 1,
                cache_misses: 1,
                compressions: 1,
                reasoning_requests: 0,
                fim_requests: 0,
                transaction_count: 3,
            }
        );
    }

    #[test]
    fn aggregates_by_session_and_provider() {
        let metrics = OptimizationMetrics::default();
        metrics.record_event(OptimizationMetricEvent {
            session_id: Some("s1".to_string()),
            provider: "claude".to_string(),
            raw_tokens: 120,
            optimized_tokens: 100,
            saved_tokens: 20,
            reasoning_requests: 1,
            ..Default::default()
        });
        metrics.record_event(OptimizationMetricEvent {
            session_id: Some("s2".to_string()),
            provider: "openai".to_string(),
            raw_tokens: 60,
            optimized_tokens: 50,
            saved_tokens: 10,
            fim_requests: 1,
            ..Default::default()
        });

        let stats = metrics.stats(Some("s1"));

        assert_eq!(stats.session.raw_tokens, 120);
        assert_eq!(stats.aggregate.saved_tokens, 30);
        assert_eq!(stats.provider_breakdown.len(), 1);
    }

    #[test]
    fn merges_live_counters_without_duplicate_token_totals() {
        let persisted = OptimizationStatsResponse {
            aggregate: OptimizationStats {
                raw_tokens: 120,
                optimized_tokens: 100,
                saved_tokens: 20,
                transaction_count: 1,
                ..Default::default()
            },
            session: OptimizationStats {
                raw_tokens: 120,
                optimized_tokens: 100,
                saved_tokens: 20,
                transaction_count: 1,
                ..Default::default()
            },
            provider_breakdown: vec![OptimizationStats {
                provider: Some("codex".to_string()),
                raw_tokens: 120,
                optimized_tokens: 100,
                saved_tokens: 20,
                transaction_count: 1,
                ..Default::default()
            }],
        };
        let live = OptimizationStatsResponse {
            aggregate: OptimizationStats {
                raw_tokens: 120,
                optimized_tokens: 100,
                saved_tokens: 20,
                transaction_count: 1,
                reasoning_requests: 1,
                ..Default::default()
            },
            session: OptimizationStats {
                raw_tokens: 120,
                optimized_tokens: 100,
                saved_tokens: 20,
                transaction_count: 1,
                reasoning_requests: 1,
                ..Default::default()
            },
            provider_breakdown: vec![OptimizationStats {
                provider: Some("codex".to_string()),
                raw_tokens: 120,
                optimized_tokens: 100,
                saved_tokens: 20,
                transaction_count: 1,
                reasoning_requests: 1,
                ..Default::default()
            }],
        };

        let merged = persisted.with_live_counters(live);

        assert_eq!(merged.aggregate.raw_tokens, 120);
        assert_eq!(merged.aggregate.reasoning_requests, 1);
        assert_eq!(merged.provider_breakdown[0].saved_tokens, 20);
        assert_eq!(merged.provider_breakdown[0].reasoning_requests, 1);
    }
}
