#![allow(dead_code)]

use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Debug, Default)]
pub struct OptimizationMetrics {
    cache_hits: AtomicU64,
    cache_misses: AtomicU64,
    compressions: AtomicU64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OptimizationStats {
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub compressions: u64,
}

impl OptimizationMetrics {
    pub fn record_cache_hit(&self) {
        self.cache_hits.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_cache_miss(&self) {
        self.cache_misses.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_compression(&self) {
        self.compressions.fetch_add(1, Ordering::Relaxed);
    }

    pub fn snapshot(&self) -> OptimizationStats {
        OptimizationStats {
            cache_hits: self.cache_hits.load(Ordering::Relaxed),
            cache_misses: self.cache_misses.load(Ordering::Relaxed),
            compressions: self.compressions.load(Ordering::Relaxed),
        }
    }
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
                cache_hits: 1,
                cache_misses: 1,
                compressions: 1,
            }
        );
    }
}
