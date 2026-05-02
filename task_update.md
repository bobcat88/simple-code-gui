# Task Update: LLM Optimization Middleware Layer

**Date:** 2026-05-02
**Status:** Planning — base de travail pour features à venir
**Branch cible:** `feature/optimization-middleware`

---

## Objectif

Ajouter une couche d'optimisation transparente dans `ai_runtime/` qui applique automatiquement les meilleures optimisations token selon le provider LLM choisi. L'utilisateur ne change rien — le système s'adapte.

**Gains attendus : -70 à -97% coût token selon provider + workload.**

---

## Architecture cible

```
CompletionRequest (brut)
        ↓
OptimizationPipeline  (nouveau — ai_runtime/optimizer.rs)
  ├── 1. TaskInferrer              (détecte type tâche depuis prompt)
  ├── 2. ContextCompressor         (LLMLingua si tokens > seuil)
  ├── 3. CacheOptimizer            (markup cache natif par provider)
  ├── 4. ReasoningOptimizer        (CoD / extended_thinking / FIM)
  ├── 5. FormatOptimizer           (YAML/TSV si structured interne)
  ├── 6. BudgetEnforcer            (max_tokens par task+role)
  └── 7. ProviderSystemPromptNorm  (format system prompt natif)
        ↓
OptimizedProvider wraps AIProvider (transparent)
        ↓
Cache check (Redis semantic) → miss → appel API → store cache
```

---

## Fichiers à créer

```
src-tauri/src/ai_runtime/
├── optimizer.rs          ← Pipeline principal + trait OptimizationMiddleware
├── middlewares/
│   ├── context_compressor.rs    ← LLMLingua bridge (Python subprocess ou PyO3)
│   ├── cache_optimizer.rs       ← cache_control Anthropic / prefix DeepSeek / cachedContent Gemini
│   ├── reasoning_optimizer.rs   ← CoD / extended_thinking / FIM DeepSeek
│   ├── format_optimizer.rs      ← JSON → YAML pour outputs internes
│   ├── budget_enforcer.rs       ← max_tokens adaptatif
│   └── system_prompt_norm.rs    ← format natif par provider
├── opt_context.rs               ← OptCtx struct (provider, task, role, token_count...)
├── semantic_cache.rs            ← Redis semantic cache (cosine sim > 0.95)
└── opt_metrics.rs               ← Token savings tracking → SQLite existant
```

---

## Matrice optimisations par provider

| Optimisation | DeepSeek | Claude | Gemini | Ollama | OpenAI |
|-------------|:-------:|:------:|:------:|:------:|:------:|
| Cache markup | prefix stable | `cache_control: ephemeral` | `cachedContent` | N/A | N/A |
| Cache hit économie | 98% ($0.0028) | 90% ($0.30) | variable | gratuit | variable |
| Fill-in-middle (code) | ✅ V4-flash | ❌ | ❌ | model-dep. | ❌ |
| Thinking/reasoning | `thinking: true` | `extended_thinking` | `thinking_config` | ❌ | `reasoning_effort` |
| CoD injection | ✅ leaf nodes | ❌ (Caveman actif) | ✅ | ✅ | ✅ |
| LLMLingua seuil | >2K tokens | >2K tokens | >2K tokens | >1K tokens | >2K tokens |
| Format YAML interne | ✅ | ✅ | ✅ | ✅ | ✅ |
| Parallel tool calls | ✅ | ✅ | ✅ | ❌ | ✅ |

---

## Code Rust — structures clés

### `opt_context.rs`

```rust
#[derive(Clone, Debug)]
pub struct OptCtx {
    pub provider: ProviderKind,
    pub task: TaskType,
    pub role: AgentRole,
    pub token_count: usize,
    pub is_leaf_node: bool,
    pub human_facing: bool,      // false → optimiser format sans souci lisibilité
    pub has_caveman_active: bool, // true → skip CoD sur Claude
    pub fim_context: Option<FimContext>, // Some → activer FIM sur DeepSeek flash
}

#[derive(Clone, Debug, PartialEq)]
pub enum ProviderKind {
    DeepSeekFlash,
    DeepSeekPro,
    ClaudeSonnet,
    ClaudeOpus,
    ClaudeHaiku,
    GeminiPro,
    GeminiFlash,
    OllamaLocal,
    OpenAICompat,
}
```

### `optimizer.rs`

```rust
pub trait OptimizationMiddleware: Send + Sync {
    fn name(&self) -> &str;
    fn apply(&self, req: &mut CompletionRequest, ctx: &OptCtx) -> Result<(), OptError>;
}

pub struct OptimizationPipeline {
    middlewares: Vec<Box<dyn OptimizationMiddleware>>,
    cache: Arc<SemanticCache>,
    compressor: Option<Arc<LLMLinguaBridge>>,
    metrics: Arc<OptMetrics>,
}

pub struct OptimizedProvider {
    inner: Box<dyn AIProvider>,
    pipeline: Arc<OptimizationPipeline>,
}

#[async_trait]
impl AIProvider for OptimizedProvider {
    async fn completion(&self, req: CompletionRequest) -> Result<CompletionResponse, String> {
        let ctx = self.infer_context(&req);

        // 1. Cache check avant optimisation
        if let Some(hit) = self.pipeline.cache.get(&req).await? {
            self.pipeline.metrics.record_cache_hit(&ctx);
            return Ok(hit);
        }

        // 2. Pipeline optimisation
        let mut optimized = req.clone();
        for mw in &self.pipeline.middlewares {
            mw.apply(&mut optimized, &ctx)?;
        }

        // 3. Appel provider interne
        let resp = self.inner.completion(optimized).await?;

        // 4. Store cache + métriques
        self.pipeline.cache.set(&req, &resp).await?;
        self.pipeline.metrics.record(&ctx, &req, &resp);

        Ok(resp)
    }

    async fn embed(&self, req: EmbeddingRequest) -> Result<EmbeddingResponse, String> {
        self.inner.embed(req).await  // pas d'optimisation sur embeddings
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, String> {
        self.inner.list_models().await
    }
}
```

### `middlewares/reasoning_optimizer.rs`

```rust
impl OptimizationMiddleware for ReasoningOptimizer {
    fn name(&self) -> &str { "reasoning_optimizer" }

    fn apply(&self, req: &mut CompletionRequest, ctx: &OptCtx) -> Result<(), OptError> {
        match ctx.task {
            TaskType::Reasoning => match ctx.provider {
                ProviderKind::ClaudeSonnet | ProviderKind::ClaudeOpus => {
                    // Extended thinking — PAS de CoD (Caveman gère l'output)
                    req.thinking = Some(ThinkingConfig {
                        budget_tokens: if ctx.role == AgentRole::Planner { 8000 } else { 4000 },
                    });
                }
                ProviderKind::DeepSeekPro | ProviderKind::DeepSeekFlash => {
                    req.extra_body.insert("thinking", json!(true));
                    if ctx.is_leaf_node {
                        // CoD sur leaf DeepSeek (pas d'extended thinking visible)
                        Self::inject_cod(req);
                    }
                }
                ProviderKind::OllamaLocal | ProviderKind::OpenAICompat => {
                    // Pas d'extended thinking → CoD systématique
                    Self::inject_cod(req);
                }
                _ => {}
            },
            TaskType::Coding => {
                if matches!(ctx.provider, ProviderKind::DeepSeekFlash) {
                    if let Some(fim) = &ctx.fim_context {
                        // Fill-in-middle DeepSeek V4-flash
                        req.fim_prefix = Some(fim.prefix.clone());
                        req.fim_suffix = Some(fim.suffix.clone());
                        req.use_fim_endpoint = true;
                    }
                }
            }
            _ => {}
        }
        Ok(())
    }
}

impl ReasoningOptimizer {
    fn inject_cod(req: &mut CompletionRequest) {
        const COD_SUFFIX: &str = "\n\nThink step by step, but keep each reasoning step to 5 words or fewer.";
        if let Some(sys) = &mut req.system {
            sys.content.push_str(COD_SUFFIX);
        }
    }
}
```

### `middlewares/cache_optimizer.rs`

```rust
impl OptimizationMiddleware for CacheOptimizer {
    fn name(&self) -> &str { "cache_optimizer" }

    fn apply(&self, req: &mut CompletionRequest, ctx: &OptCtx) -> Result<(), OptError> {
        match ctx.provider {
            ProviderKind::ClaudeSonnet | ProviderKind::ClaudeOpus | ProviderKind::ClaudeHaiku => {
                // Anthropic native cache — 90% moins cher sur cache hit
                if let Some(sys) = &mut req.system {
                    sys.cache_control = Some(json!({"type": "ephemeral"}));
                }
            }
            ProviderKind::DeepSeekFlash | ProviderKind::DeepSeekPro => {
                // Prefix cache DeepSeek — stabiliser l'ordre messages
                // System prompt toujours en premier, identique → 98% moins cher ($0.0028/MTok)
                req.messages = self.normalize_prefix_order(req.messages.clone());
            }
            ProviderKind::GeminiPro | ProviderKind::GeminiFlash => {
                // cachedContent API si system > 4K tokens
                if ctx.token_count > 4000 {
                    // async — géré via handle séparé
                    req.gemini_cached_content_name = self.get_or_create_cached_content(req);
                }
            }
            ProviderKind::OllamaLocal => { /* gratuit, pas de cache API */ }
            _ => {}
        }
        Ok(())
    }
}
```

### `middlewares/format_optimizer.rs`

```rust
impl OptimizationMiddleware for FormatOptimizer {
    fn name(&self) -> &str { "format_optimizer" }

    fn apply(&self, req: &mut CompletionRequest, ctx: &OptCtx) -> Result<(), OptError> {
        // JSON → YAML pour outputs inter-agents (non lus par humain) → -50% tokens
        if !ctx.human_facing && req.response_format == Some(ResponseFormat::JsonObject) {
            req.response_format = None;
            const YAML_INSTR: &str = "\n\nRespond in YAML format only. No JSON. No markdown wrapper. No explanation.";
            if let Some(sys) = &mut req.system {
                sys.content.push_str(YAML_INSTR);
            }
        }
        Ok(())
    }
}
```

---

## Intégration dans `lib.rs`

```rust
// Init pipeline au démarrage Tauri (une fois)
let llmlingua_bridge = LLMLinguaBridge::new().ok(); // optionnel si Python absent
let redis_client = redis::Client::open("redis://127.0.0.1/").ok();

let pipeline = Arc::new(
    OptimizationPipeline::builder()
        .add(ContextCompressor::new(llmlingua_bridge))
        .add(CacheOptimizer::new(redis_client))
        .add(ReasoningOptimizer::new())
        .add(FormatOptimizer::new())
        .add(BudgetEnforcer::new())
        .add(ProviderSystemPromptNormalizer::new())
        .with_metrics(token_metrics.clone())
        .build()
);

// Wrapper chaque provider enregistré
let provider = OptimizedProvider::new(raw_provider, pipeline.clone());
```

---

## Nouvelles métriques UI — panneau "Optimization"

```typescript
// Nouveau widget dans Settings ou Session Stats
interface OptimizationStats {
  provider: string
  session_tokens_raw: number
  session_tokens_after_optimization: number
  optimization_ratio: number        // ex: 0.73 = 73% économisé
  cache_hits: number
  cache_misses: number
  llmlingua_compressions: number
  cod_injections: number
  fim_calls: number                 // DeepSeek flash seulement
  estimated_savings_usd: number
}

// Commande Tauri à ajouter
getOptimizationStats(sessionId?: string): Promise<OptimizationStats>
```

---

## Dépendances à ajouter

### Rust (`Cargo.toml`)

```toml
[dependencies]
# Semantic cache Redis
redis = { version = "0.25", features = ["tokio-comp", "connection-manager"] }

# Similarity (pour semantic cache cosine)
ndarray = "0.15"

# JSON flexible pour extra_body provider-specific
serde_json = "1"  # déjà présent probablement
```

### Python (LLMLingua bridge — subprocess ou PyO3)

```bash
uv add llmlingua
# Model: microsoft/llmlingua-2-xlm-roberta-large-meetingbank
# Init once, expose via HTTP ou stdin/stdout IPC
```

---

## Phases d'implémentation

### Phase 1 — Structure + Provider DeepSeek (priorité haute)
- [ ] Créer `optimizer.rs` + trait `OptimizationMiddleware`
- [ ] Créer `opt_context.rs` + `ProviderKind` enum
- [ ] Créer `OptimizedProvider` wrapper
- [ ] Ajouter `DeepSeekFlash` / `DeepSeekPro` dans `ProviderKind`
- [ ] Configurer `base_url = https://api.deepseek.com` dans settings
- [ ] `cache_optimizer.rs` → prefix stable DeepSeek ($0.0028 cache hit)
- [ ] `budget_enforcer.rs` → max_tokens adaptatif

### Phase 2 — Anthropic optimisations
- [ ] `cache_optimizer.rs` → `cache_control: ephemeral` Claude
- [ ] `reasoning_optimizer.rs` → `extended_thinking` Claude
- [ ] Vérifier pas de CoD si Caveman actif (`has_caveman_active` flag)

### Phase 3 — Compression contexte
- [ ] `LLMLinguaBridge` → subprocess Python IPC
- [ ] `context_compressor.rs` → trigger si tokens > seuil par provider
- [ ] `semantic_cache.rs` → Redis cosine sim > 0.95

### Phase 4 — Gemini + Ollama + OpenAI
- [ ] `cache_optimizer.rs` → Gemini `cachedContent` API
- [ ] `reasoning_optimizer.rs` → CoD Ollama / OpenAI
- [ ] `format_optimizer.rs` → YAML pour tous providers
- [ ] `system_prompt_norm.rs` → format natif Gemini (`system_instruction`)

### Phase 5 — UI métriques
- [ ] `opt_metrics.rs` → SQLite (réutiliser `token_events` existant)
- [ ] Commande Tauri `getOptimizationStats()`
- [ ] Widget frontend "Optimization Stats"

---

## References

- [[Token Efficiency Stack]] — synthèse des 6 couches
- [[AI Project Architecture Template]] — architecture globale
- [[LLM Model Selection]] — pricing DeepSeek / Claude / Gemini
- [[LLMLingua]] — compression input
- [[Chain of Draft]] — compression raisonnement
- [[Caveman]] — compression output (interaction Caveman↔CoD)
- `src-tauri/src/ai_runtime/` — point d'insertion dans codebase existante
