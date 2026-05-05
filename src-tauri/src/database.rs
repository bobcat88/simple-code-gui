use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use tauri::AppHandle;
use tauri::Manager;
use crate::ai_runtime::opt_metrics::{OptimizationStats, OptimizationStatsResponse};
use crate::orchestration::AgentMessage;

pub struct DatabaseManager {
    pub pool: SqlitePool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenTransactionInput {
    pub session_id: String,
    pub nexus_session_id: Option<String>,
    pub agent_id: Option<String>,
    pub project_path: String,
    pub backend: String,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub saved_tokens: Option<i64>,
    pub cost_estimate: f64,
    pub context_reuse_id: Option<String>,
    pub cache_control: Option<serde_json::Value>,
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TokenHistoryFilters {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub project_path: Option<String>,
    pub backend: Option<String>,
    pub session_id: Option<String>,
    pub nexus_session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TokenHistoryTotals {
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cost_estimate: f64,
    pub transaction_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenHistorySession {
    pub session_id: String,
    pub project_path: String,
    pub backend: String,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cost_estimate: f64,
    pub first_timestamp: String,
    pub last_timestamp: String,
    pub transaction_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenHistoryBreakdown {
    pub key: String,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cost_estimate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenHistoryPoint {
    pub date: String,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cost_estimate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenHistoryResponse {
    pub totals: TokenHistoryTotals,
    pub sessions: Vec<TokenHistorySession>,
    pub project_breakdown: Vec<TokenHistoryBreakdown>,
    pub backend_breakdown: Vec<TokenHistoryBreakdown>,
    pub daily: Vec<TokenHistoryPoint>,
}

pub async fn insert_cognitive_feedback(
    pool: &SqlitePool,
    context_id: &str,
    action: &str,
    feedback: &str,
    is_positive: bool,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO cognitive_feedback (context_id, action, feedback, is_positive)
         VALUES (?, ?, ?, ?)",
    )
    .bind(context_id)
    .bind(action)
    .bind(feedback)
    .bind(is_positive)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn insert_token_transaction(
    pool: &SqlitePool,
    transaction: &TokenTransactionInput,
) -> Result<(), String> {
    // AC: @01KPNWTT ac-2
    sqlx::query(
        "INSERT INTO token_transactions
            (session_id, nexus_session_id, agent_id, project_path, backend, input_tokens, output_tokens, saved_tokens, cost_estimate, context_reuse_id, cache_control, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))",
    )
    .bind(&transaction.session_id)
    .bind(&transaction.nexus_session_id)
    .bind(&transaction.agent_id)
    .bind(&transaction.project_path)
    .bind(&transaction.backend)
    .bind(transaction.input_tokens)
    .bind(transaction.output_tokens)
    .bind(transaction.saved_tokens.unwrap_or(0))
    .bind(transaction.cost_estimate)
    .bind(&transaction.context_reuse_id)
    .bind(transaction.cache_control.as_ref().map(|c| serde_json::to_string(c).unwrap()))
    .bind(&transaction.timestamp)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn query_token_history(
    pool: &SqlitePool,
    filters: TokenHistoryFilters,
) -> Result<TokenHistoryResponse, String> {
    // AC: @01KPNWTT ac-3
    let project_path = filters.project_path.as_deref();
    let backend = filters.backend.as_deref();
    let start_date = filters.start_date.as_deref();
    let end_date = filters.end_date.as_deref();
    let session_id = filters.session_id.as_deref();
    let nexus_session_id = filters.nexus_session_id.as_deref();

    let totals = sqlx::query_as::<_, (i64, i64, f64, i64)>(
        "SELECT
            COALESCE(SUM(input_tokens), 0),
            COALESCE(SUM(output_tokens), 0),
            COALESCE(SUM(cost_estimate), 0.0),
            COUNT(*)
         FROM token_transactions
         WHERE (? IS NULL OR project_path = ?)
           AND (? IS NULL OR backend = ?)
           AND (? IS NULL OR timestamp >= ?)
           AND (? IS NULL OR timestamp <= ?)
           AND (? IS NULL OR session_id = ?)
           AND (? IS NULL OR nexus_session_id = ?)",
    )
    .bind(project_path)
    .bind(project_path)
    .bind(backend)
    .bind(backend)
    .bind(start_date)
    .bind(start_date)
    .bind(end_date)
    .bind(end_date)
    .bind(session_id)
    .bind(session_id)
    .bind(nexus_session_id)
    .bind(nexus_session_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let sessions =
        sqlx::query_as::<_, (String, String, String, i64, i64, f64, String, String, i64)>(
            "SELECT
                session_id,
                project_path,
                backend,
                COALESCE(SUM(input_tokens), 0),
                COALESCE(SUM(output_tokens), 0),
                COALESCE(SUM(cost_estimate), 0.0),
                MIN(timestamp),
                MAX(timestamp),
                COUNT(*)
             FROM token_transactions
             WHERE (? IS NULL OR project_path = ?)
               AND (? IS NULL OR backend = ?)
               AND (? IS NULL OR timestamp >= ?)
               AND (? IS NULL OR timestamp <= ?)
               AND (? IS NULL OR session_id = ?)
               AND (? IS NULL OR nexus_session_id = ?)
             GROUP BY session_id, project_path, backend
             ORDER BY MAX(timestamp) DESC",
        )
        .bind(project_path)
        .bind(project_path)
        .bind(backend)
        .bind(backend)
        .bind(start_date)
        .bind(start_date)
        .bind(end_date)
        .bind(end_date)
        .bind(session_id)
        .bind(session_id)
        .bind(nexus_session_id)
        .bind(nexus_session_id)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?
        .into_iter()
        .map(
            |(
                session_id,
                project_path,
                backend,
                input_tokens,
                output_tokens,
                cost_estimate,
                first_timestamp,
                last_timestamp,
                transaction_count,
            )| TokenHistorySession {
                session_id,
                project_path,
                backend,
                input_tokens,
                output_tokens,
                cost_estimate,
                first_timestamp,
                last_timestamp,
                transaction_count,
            },
        )
        .collect();

    let project_breakdown = token_breakdown(pool, "project_path", &filters).await?;
    let backend_breakdown = token_breakdown(pool, "backend", &filters).await?;
    let daily = daily_token_history(pool, &filters).await?;

    Ok(TokenHistoryResponse {
        totals: TokenHistoryTotals {
            input_tokens: totals.0,
            output_tokens: totals.1,
            cost_estimate: totals.2,
            transaction_count: totals.3,
        },
        sessions,
        project_breakdown,
        backend_breakdown,
        daily,
    })
}

pub async fn query_optimization_token_stats(
    pool: &SqlitePool,
    session_id: Option<&str>,
) -> Result<OptimizationStatsResponse, String> {
    let aggregate = optimization_token_totals(pool, None, None).await?;
    let session = optimization_token_totals(pool, session_id, None).await?;
    let provider_breakdown = optimization_provider_breakdown(pool, session_id).await?;

    Ok(OptimizationStatsResponse {
        aggregate,
        session,
        provider_breakdown,
    })
}

async fn optimization_token_totals(
    pool: &SqlitePool,
    session_id: Option<&str>,
    provider: Option<&str>,
) -> Result<OptimizationStats, String> {
    let row = sqlx::query_as::<_, (i64, i64, i64, i64)>(
        "SELECT
            COALESCE(SUM(input_tokens + output_tokens + CASE WHEN saved_tokens > 0 THEN saved_tokens ELSE 0 END), 0),
            COALESCE(SUM(input_tokens + output_tokens), 0),
            COALESCE(SUM(CASE WHEN saved_tokens > 0 THEN saved_tokens ELSE 0 END), 0),
            COUNT(*)
         FROM token_transactions
         WHERE (? IS NULL OR session_id = ?)
           AND (? IS NULL OR backend = ?)",
    )
    .bind(session_id)
    .bind(session_id)
    .bind(provider)
    .bind(provider)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(OptimizationStats {
        provider: provider.map(str::to_string),
        raw_tokens: row.0 as u64,
        optimized_tokens: row.1 as u64,
        saved_tokens: row.2 as u64,
        transaction_count: row.3 as u64,
        ..Default::default()
    })
}

async fn optimization_provider_breakdown(
    pool: &SqlitePool,
    session_id: Option<&str>,
) -> Result<Vec<OptimizationStats>, String> {
    sqlx::query_as::<_, (String, i64, i64, i64, i64)>(
        "SELECT
            backend,
            COALESCE(SUM(input_tokens + output_tokens + CASE WHEN saved_tokens > 0 THEN saved_tokens ELSE 0 END), 0),
            COALESCE(SUM(input_tokens + output_tokens), 0),
            COALESCE(SUM(CASE WHEN saved_tokens > 0 THEN saved_tokens ELSE 0 END), 0),
            COUNT(*)
         FROM token_transactions
         WHERE (? IS NULL OR session_id = ?)
         GROUP BY backend
         ORDER BY SUM(input_tokens + output_tokens) DESC",
    )
    .bind(session_id)
    .bind(session_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
    .map(|rows| {
        rows.into_iter()
            .map(|(provider, raw_tokens, optimized_tokens, saved_tokens, transaction_count)| OptimizationStats {
                provider: Some(provider),
                raw_tokens: raw_tokens as u64,
                optimized_tokens: optimized_tokens as u64,
                saved_tokens: saved_tokens as u64,
                transaction_count: transaction_count as u64,
                ..Default::default()
            })
            .collect()
    })
}

async fn token_breakdown(
    pool: &SqlitePool,
    group_column: &str,
    filters: &TokenHistoryFilters,
) -> Result<Vec<TokenHistoryBreakdown>, String> {
    let project_path = filters.project_path.as_deref();
    let backend = filters.backend.as_deref();
    let start_date = filters.start_date.as_deref();
    let end_date = filters.end_date.as_deref();
    let query = format!(
        "SELECT
            {group_column},
            COALESCE(SUM(input_tokens), 0),
            COALESCE(SUM(output_tokens), 0),
            COALESCE(SUM(cost_estimate), 0.0)
         FROM token_transactions
         WHERE (? IS NULL OR project_path = ?)
           AND (? IS NULL OR backend = ?)
           AND (? IS NULL OR timestamp >= ?)
           AND (? IS NULL OR timestamp <= ?)
         GROUP BY {group_column}
         ORDER BY SUM(input_tokens + output_tokens) DESC"
    );

    sqlx::query_as::<_, (String, i64, i64, f64)>(&query)
        .bind(project_path)
        .bind(project_path)
        .bind(backend)
        .bind(backend)
        .bind(start_date)
        .bind(start_date)
        .bind(end_date)
        .bind(end_date)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())
        .map(|rows| {
            rows.into_iter()
                .map(
                    |(key, input_tokens, output_tokens, cost_estimate)| TokenHistoryBreakdown {
                        key,
                        input_tokens,
                        output_tokens,
                        cost_estimate,
                    },
                )
                .collect()
        })
}

async fn daily_token_history(
    pool: &SqlitePool,
    filters: &TokenHistoryFilters,
) -> Result<Vec<TokenHistoryPoint>, String> {
    let project_path = filters.project_path.as_deref();
    let backend = filters.backend.as_deref();
    let start_date = filters.start_date.as_deref();
    let end_date = filters.end_date.as_deref();

    sqlx::query_as::<_, (String, i64, i64, f64)>(
        "SELECT
            DATE(timestamp),
            COALESCE(SUM(input_tokens), 0),
            COALESCE(SUM(output_tokens), 0),
            COALESCE(SUM(cost_estimate), 0.0)
         FROM token_transactions
         WHERE (? IS NULL OR project_path = ?)
           AND (? IS NULL OR backend = ?)
           AND (? IS NULL OR timestamp >= ?)
           AND (? IS NULL OR timestamp <= ?)
         GROUP BY DATE(timestamp)
         ORDER BY DATE(timestamp) ASC",
    )
    .bind(project_path)
    .bind(project_path)
    .bind(backend)
    .bind(backend)
    .bind(start_date)
    .bind(start_date)
    .bind(end_date)
    .bind(end_date)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
    .map(|rows| {
        rows.into_iter()
            .map(
                |(date, input_tokens, output_tokens, cost_estimate)| TokenHistoryPoint {
                    date,
                    input_tokens,
                    output_tokens,
                    cost_estimate,
                },
            )
            .collect()
    })
}

impl DatabaseManager {
    pub async fn new(app: &AppHandle) -> Result<Self, String> {
        let app_dir = app.path().app_config_dir().unwrap();
        if !app_dir.exists() {
            std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
        }
        let db_path = app_dir.join("app.db");

        let options = SqliteConnectOptions::new()
            .filename(db_path)
            .create_if_missing(true);

        let pool = SqlitePool::connect_with(options)
            .await
            .map_err(|e| e.to_string())?;

        let manager = Self { pool };
        manager.run_migrations().await?;

        Ok(manager)
    }

    async fn run_migrations(&self) -> Result<(), String> {
        // Settings Table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // Projects Table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                category_id TEXT,
                last_accessed TEXT
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // Categories Table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // Token Events Table (for scg-ai-metering)
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS token_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                project_id TEXT,
                task_id TEXT,
                model TEXT,
                input_tokens INTEGER,
                output_tokens INTEGER,
                saved_tokens INTEGER DEFAULT 0,
                cost_est REAL DEFAULT 0.0
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // AC: @01KPNWTT ac-1
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS token_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                agent_id TEXT,
                project_path TEXT NOT NULL,
                backend TEXT NOT NULL,
                input_tokens INTEGER NOT NULL DEFAULT 0,
                output_tokens INTEGER NOT NULL DEFAULT 0,
                saved_tokens INTEGER NOT NULL DEFAULT 0,
                cost_estimate REAL NOT NULL DEFAULT 0.0,
                context_reuse_id TEXT,
                timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let _ = sqlx::query("ALTER TABLE token_transactions ADD COLUMN saved_tokens INTEGER DEFAULT 0")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE token_transactions ADD COLUMN context_reuse_id TEXT")
            .execute(&self.pool)
            .await;

        let _ = sqlx::query("ALTER TABLE token_transactions ADD COLUMN agent_id TEXT")
            .execute(&self.pool)
            .await;

        let _ = sqlx::query("ALTER TABLE token_transactions ADD COLUMN nexus_session_id TEXT")
            .execute(&self.pool)
            .await;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_token_transactions_filters
             ON token_transactions (timestamp, project_path, backend)",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_token_transactions_session
             ON token_transactions (session_id)",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // API Keys Table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS api_keys (
                provider TEXT PRIMARY KEY,
                key TEXT NOT NULL,
                base_url TEXT
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // Background Jobs Table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS background_jobs (
                id TEXT PRIMARY KEY,
                job_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                status TEXT NOT NULL,
                progress REAL DEFAULT 0.0,
                result TEXT,
                error TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // Activity Log Table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                source TEXT NOT NULL,
                message TEXT NOT NULL,
                metadata TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // Agents Table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                status TEXT NOT NULL,
                model TEXT,
                provider TEXT,
                burn_rate REAL DEFAULT 0.0,
                quality_score REAL DEFAULT 0.0,
                error_rate REAL DEFAULT 0.0,
                queue_size INTEGER DEFAULT 0,
                active_task TEXT,
                evolution_confidence REAL DEFAULT 0.0,
                evolution_status TEXT DEFAULT 'stable',
                last_active DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // Migration for existing databases
        let _ = sqlx::query("ALTER TABLE agents ADD COLUMN model TEXT")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE agents ADD COLUMN provider TEXT")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE agents ADD COLUMN burn_rate REAL DEFAULT 0.0")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE agents ADD COLUMN quality_score REAL DEFAULT 0.0")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE agents ADD COLUMN queue_size INTEGER DEFAULT 0")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE agents ADD COLUMN active_task TEXT")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE agents ADD COLUMN error_rate REAL DEFAULT 0.0")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE agents ADD COLUMN evolution_confidence REAL DEFAULT 0.0")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE agents ADD COLUMN evolution_status TEXT DEFAULT 'stable'")
            .execute(&self.pool)
            .await;

        // Health Logs Table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS health_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                check_type TEXT NOT NULL,
                status TEXT NOT NULL,
                details TEXT
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        
        // RTK Assimilation: Context Signatures
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS context_signatures (
                id TEXT PRIMARY KEY,
                hash TEXT UNIQUE NOT NULL,
                size_tokens INTEGER NOT NULL,
                hits INTEGER DEFAULT 1,
                last_used DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // Agent Tasks Queue Table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS agent_tasks (
                id TEXT PRIMARY KEY,
                agent_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                priority INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'queued',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(agent_id) REFERENCES agents(id)
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // Agent Execution Traces
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS agent_traces (
                id TEXT PRIMARY KEY,
                agent_id TEXT NOT NULL,
                task_id TEXT,
                step_name TEXT NOT NULL,
                details TEXT,
                status TEXT NOT NULL,
                duration_ms INTEGER,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(agent_id) REFERENCES agents(id),
                FOREIGN KEY(task_id) REFERENCES agent_tasks(id)
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS vector_chunks (
                id TEXT PRIMARY KEY,
                project_path TEXT NOT NULL,
                file_path TEXT NOT NULL,
                symbol_name TEXT,
                content TEXT NOT NULL,
                embedding TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_vector_chunks_project
             ON vector_chunks (project_path)",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // Swarm Snapshots Table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS swarm_snapshots (
                id TEXT PRIMARY KEY,
                project_path TEXT NOT NULL,
                name TEXT,
                commit_sha TEXT,
                worktree_path TEXT,
                handoff_notes TEXT,
                timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // Ensure name column exists (for migrations)
        let _ = sqlx::query("ALTER TABLE swarm_snapshots ADD COLUMN name TEXT")
            .execute(&self.pool)
            .await;
        
        let _ = sqlx::query("ALTER TABLE swarm_snapshots ADD COLUMN handoff_notes TEXT")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE swarm_snapshots ADD COLUMN worktree_path TEXT")
            .execute(&self.pool)
            .await;

        // Swarm Messages Table (Cognitive Log)
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS swarm_messages (
                id TEXT PRIMARY KEY,
                snapshot_id TEXT,
                project_path TEXT,
                timestamp INTEGER NOT NULL,
                from_agent TEXT NOT NULL,
                to_agent TEXT,
                message_type TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata TEXT,
                cache_control TEXT,
                FOREIGN KEY(snapshot_id) REFERENCES swarm_snapshots(id)
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_swarm_messages_snapshot
             ON swarm_messages (snapshot_id)",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_swarm_messages_project
             ON swarm_messages (project_path)",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // Cognitive Feedback Table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS cognitive_feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                context_id TEXT NOT NULL,
                action TEXT NOT NULL,
                feedback TEXT,
                is_positive BOOLEAN NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(())
    }
}

pub async fn insert_vector_chunk(
    pool: &sqlx::SqlitePool,
    chunk: &crate::vector_engine::types::VectorChunk,
) -> Result<(), String> {
    let embedding_json = chunk.embedding.as_ref().map(|e| serde_json::to_string(e).unwrap());
    let metadata_json = serde_json::to_string(&chunk.metadata).unwrap_or_else(|_| "{}".to_string());

    sqlx::query(
        "INSERT INTO vector_chunks 
            (id, project_path, file_path, symbol_name, content, embedding, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            embedding = excluded.embedding,
            metadata = excluded.metadata,
            content = excluded.content,
            symbol_name = excluded.symbol_name",
    )
    .bind(&chunk.id)
    .bind(&chunk.project_path)
    .bind(&chunk.file_path)
    .bind(&chunk.symbol_name)
    .bind(&chunk.content)
    .bind(embedding_json)
    .bind(metadata_json)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn get_vector_chunks(
    pool: &sqlx::SqlitePool,
    project_path: Option<&str>,
) -> Result<Vec<crate::vector_engine::types::VectorChunk>, String> {
    let rows = if let Some(path) = project_path {
        sqlx::query_as::<_, (String, String, String, String, String, Option<String>, String)>(
            "SELECT id, project_path, file_path, symbol_name, content, embedding, metadata 
             FROM vector_chunks WHERE project_path = ?",
        )
        .bind(path)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as::<_, (String, String, String, String, String, Option<String>, String)>(
            "SELECT id, project_path, file_path, symbol_name, content, embedding, metadata 
             FROM vector_chunks",
        )
        .fetch_all(pool)
        .await
    }.map_err(|e| e.to_string())?;

    let chunks = rows.into_iter().map(|(id, project_path, file_path, symbol_name, content, embedding_json, metadata_json)| {
        let embedding = embedding_json.and_then(|s| serde_json::from_str(&s).ok());
        let metadata = serde_json::from_str(&metadata_json).unwrap_or_default();

        crate::vector_engine::types::VectorChunk {
            id,
            project_path,
            file_path,
            symbol_name,
            content,
            embedding,
            metadata,
        }
    }).collect();

    Ok(chunks)
}

pub async fn insert_swarm_message(
    pool: &SqlitePool,
    message: &AgentMessage,
    project_path: Option<&str>,
    snapshot_id: Option<&str>,
) -> Result<(), String> {
    let metadata_json = message.metadata.as_ref().map(|m| serde_json::to_string(m).unwrap());
    let cache_control_json = message.cache_control.as_ref().map(|c| serde_json::to_string(c).unwrap());

    sqlx::query(
        "INSERT OR IGNORE INTO swarm_messages 
            (id, snapshot_id, project_path, timestamp, from_agent, to_agent, message_type, content, metadata, cache_control)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&message.id)
    .bind(snapshot_id)
    .bind(project_path)
    .bind(message.timestamp as i64)
    .bind(&message.from_agent)
    .bind(&message.to_agent)
    .bind(&message.message_type)
    .bind(&message.content)
    .bind(metadata_json)
    .bind(cache_control_json)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn get_swarm_messages(
    pool: &SqlitePool,
    project_path: Option<&str>,
    snapshot_id: Option<&str>,
    limit: Option<usize>,
) -> Result<Vec<AgentMessage>, String> {
    let l = limit.map(|n| n as i64).unwrap_or(-1);

    let rows = sqlx::query_as::<_, (String, i64, String, Option<String>, String, String, Option<String>, Option<String>)>(
        "SELECT id, timestamp, from_agent, to_agent, message_type, content, metadata, cache_control 
         FROM swarm_messages 
         WHERE (? IS NULL OR project_path = ?)
           AND (? IS NULL OR snapshot_id = ?)
         ORDER BY timestamp DESC
         LIMIT ?",
    )
    .bind(project_path)
    .bind(project_path)
    .bind(snapshot_id)
    .bind(snapshot_id)
    .bind(l)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let messages = rows.into_iter().map(|(id, timestamp, from_agent, to_agent, message_type, content, metadata_json, cache_control_json)| {
        let metadata = metadata_json.and_then(|s| serde_json::from_str(&s).ok());
        let cache_control = cache_control_json.and_then(|s| serde_json::from_str(&s).ok());

        AgentMessage {
            id,
            timestamp: timestamp as u64,
            from_agent,
            to_agent,
            message_type,
            content,
            metadata,
            cache_control,
        }
    }).collect();

    Ok(messages)
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct SwarmSnapshot {
    pub id: String,
    pub project_path: String,
    pub name: Option<String>,
    pub commit_sha: Option<String>,
    pub worktree_path: Option<String>,
    pub handoff_notes: Option<String>,
    pub timestamp: String,
}

pub async fn create_swarm_snapshot(
    pool: &SqlitePool,
    id: &str,
    project_path: &str,
    name: Option<&str>,
    commit_sha: Option<&str>,
    worktree_path: Option<&str>,
    handoff_notes: Option<&str>,
) -> Result<(), String> {
    sqlx::query(
        "INSERT OR IGNORE INTO swarm_snapshots (id, project_path, name, commit_sha, worktree_path, handoff_notes) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id)
    .bind(project_path)
    .bind(name)
    .bind(commit_sha)
    .bind(worktree_path)
    .bind(handoff_notes)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn get_swarm_snapshot(
    pool: &SqlitePool,
    id: &str,
) -> Result<SwarmSnapshot, String> {
    sqlx::query_as::<_, SwarmSnapshot>(
        "SELECT id, project_path, name, commit_sha, worktree_path, timestamp FROM swarm_snapshots WHERE id = ?"
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())
}

pub async fn update_swarm_snapshot_worktree(
    pool: &SqlitePool,
    id: &str,
    worktree_path: &str,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE swarm_snapshots SET worktree_path = ? WHERE id = ?"
    )
    .bind(worktree_path)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn get_swarm_snapshots(
    pool: &SqlitePool,
    project_path: Option<&str>,
) -> Result<Vec<SwarmSnapshot>, String> {
    let query = if let Some(path) = project_path {
        sqlx::query_as::<_, SwarmSnapshot>(
            "SELECT id, project_path, name, commit_sha, worktree_path, handoff_notes, timestamp FROM swarm_snapshots WHERE project_path = ? ORDER BY timestamp DESC"
        )
        .bind(path)
    } else {
        sqlx::query_as::<_, SwarmSnapshot>(
            "SELECT id, project_path, name, commit_sha, worktree_path, handoff_notes, timestamp FROM swarm_snapshots ORDER BY timestamp DESC"
        )
    };

    query.fetch_all(pool).await.map_err(|e| e.to_string())
}

pub async fn link_messages_to_snapshot(
    pool: &SqlitePool,
    snapshot_id: &str,
    project_path: &str,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE swarm_messages SET snapshot_id = ? WHERE project_path = ? AND snapshot_id IS NULL"
    )
    .bind(snapshot_id)
    .bind(project_path)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}


#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

    async fn memory_pool() -> SqlitePool {
        let options = SqliteConnectOptions::new()
            .filename(":memory:")
            .create_if_missing(true);

        SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .unwrap()
    }

    async fn create_token_transactions_table(pool: &SqlitePool) {
        sqlx::query(
            "CREATE TABLE token_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                nexus_session_id TEXT,
                agent_id TEXT,
                project_path TEXT NOT NULL,
                backend TEXT NOT NULL,
                input_tokens INTEGER NOT NULL DEFAULT 0,
                output_tokens INTEGER NOT NULL DEFAULT 0,
                saved_tokens INTEGER NOT NULL DEFAULT 0,
                cost_estimate REAL NOT NULL DEFAULT 0.0,
                context_reuse_id TEXT,
                timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(pool)
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn inserts_token_transaction_rows() {
        // AC: @01KPNWTT ac-2
        let pool = memory_pool().await;
        create_token_transactions_table(&pool).await;

        insert_token_transaction(
            &pool,
            &TokenTransactionInput {
                session_id: "pty-1".into(),
                nexus_session_id: None,
                agent_id: Some("agent-1".into()),
                project_path: "/repo".into(),
                backend: "codex".into(),
                input_tokens: 120,
                output_tokens: 40,
                cost_estimate: 0.012,
                saved_tokens: Some(0),
                context_reuse_id: None,
                cache_control: None,
                timestamp: Some("2026-04-21 10:00:00".into()),
            },
        )
        .await
        .unwrap();

        let row: (String, String, String, i64, i64, f64) = sqlx::query_as(
            "SELECT session_id, project_path, backend, input_tokens, output_tokens, cost_estimate
             FROM token_transactions",
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(row.0, "pty-1");
        assert_eq!(row.1, "/repo");
        assert_eq!(row.2, "codex");
        assert_eq!(row.3, 120);
        assert_eq!(row.4, 40);
        assert_eq!(row.5, 0.012);
    }

    #[tokio::test]
    async fn queries_filtered_aggregate_and_session_history() {
        // AC: @01KPNWTT ac-3
        let pool = memory_pool().await;
        create_token_transactions_table(&pool).await;

        for transaction in [
            TokenTransactionInput {
                session_id: "s1".into(),
                nexus_session_id: None,
                agent_id: None,
                project_path: "/repo-a".into(),
                backend: "codex".into(),
                input_tokens: 100,
                output_tokens: 50,
                cost_estimate: 0.01,
                saved_tokens: Some(0),
                context_reuse_id: None,
                cache_control: None,
                timestamp: Some("2026-04-20 08:00:00".into()),
            },
            TokenTransactionInput {
                session_id: "s1".into(),
                nexus_session_id: None,
                agent_id: None,
                project_path: "/repo-a".into(),
                backend: "codex".into(),
                input_tokens: 40,
                output_tokens: 10,
                cost_estimate: 0.004,
                saved_tokens: Some(0),
                context_reuse_id: None,
                cache_control: None,
                timestamp: Some("2026-04-21 09:00:00".into()),
            },
            TokenTransactionInput {
                session_id: "s2".into(),
                nexus_session_id: None,
                agent_id: None,
                project_path: "/repo-b".into(),
                backend: "claude".into(),
                input_tokens: 999,
                output_tokens: 1,
                cost_estimate: 1.0,
                saved_tokens: Some(0),
                context_reuse_id: None,
                cache_control: None,
                timestamp: Some("2026-04-21 09:00:00".into()),
            },
        ] {
            insert_token_transaction(&pool, &transaction).await.unwrap();
        }

        let history = query_token_history(
            &pool,
            TokenHistoryFilters {
                start_date: Some("2026-04-20 00:00:00".into()),
                end_date: Some("2026-04-21 23:59:59".into()),
                project_path: Some("/repo-a".into()),
                backend: Some("codex".into()),
                session_id: None,
                nexus_session_id: None,
            },
        )
        .await
        .unwrap();

        assert_eq!(history.totals.input_tokens, 140);
        assert_eq!(history.totals.output_tokens, 60);
        assert_eq!(history.totals.transaction_count, 2);
        assert_eq!(history.sessions.len(), 1);
        assert_eq!(history.sessions[0].session_id, "s1");
        assert_eq!(history.backend_breakdown[0].key, "codex");
        assert_eq!(history.project_breakdown[0].key, "/repo-a");
        assert_eq!(history.daily.len(), 2);
    }

    #[tokio::test]
    async fn queries_persisted_optimization_token_stats() {
        let pool = memory_pool().await;
        create_token_transactions_table(&pool).await;

        for transaction in [
            TokenTransactionInput {
                session_id: "s1".into(),
                nexus_session_id: None,
                agent_id: None,
                project_path: "/repo-a".into(),
                backend: "codex".into(),
                input_tokens: 100,
                output_tokens: 50,
                cost_estimate: 0.01,
                saved_tokens: Some(25),
                context_reuse_id: Some("reuse-1".into()),
                cache_control: None,
                timestamp: Some("2026-05-02 10:00:00".into()),
            },
            TokenTransactionInput {
                session_id: "s1".into(),
                nexus_session_id: None,
                agent_id: None,
                project_path: "/repo-a".into(),
                backend: "claude".into(),
                input_tokens: 40,
                output_tokens: 10,
                cost_estimate: 0.004,
                saved_tokens: Some(5),
                context_reuse_id: None,
                cache_control: None,
                timestamp: Some("2026-05-02 10:05:00".into()),
            },
            TokenTransactionInput {
                session_id: "s2".into(),
                nexus_session_id: None,
                agent_id: None,
                project_path: "/repo-b".into(),
                backend: "codex".into(),
                input_tokens: 30,
                output_tokens: 10,
                cost_estimate: 0.002,
                saved_tokens: Some(10),
                context_reuse_id: None,
                cache_control: None,
                timestamp: Some("2026-05-02 11:00:00".into()),
            },
        ] {
            insert_token_transaction(&pool, &transaction).await.unwrap();
        }

        let stats = query_optimization_token_stats(&pool, Some("s1")).await.unwrap();

        assert_eq!(stats.aggregate.raw_tokens, 280);
        assert_eq!(stats.aggregate.optimized_tokens, 240);
        assert_eq!(stats.aggregate.saved_tokens, 40);
        assert_eq!(stats.session.raw_tokens, 230);
        assert_eq!(stats.session.optimized_tokens, 200);
        assert_eq!(stats.session.saved_tokens, 30);
        assert_eq!(stats.provider_breakdown.len(), 2);
        assert_eq!(stats.provider_breakdown[0].provider.as_deref(), Some("codex"));
    }
}
