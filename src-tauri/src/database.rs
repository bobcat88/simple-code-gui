use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use tauri::AppHandle;
use tauri::Manager;

pub struct DatabaseManager {
    pub pool: SqlitePool,
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
            )"
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
            )"
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
            )"
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
            )"
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
            )"
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
            )"
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
            )"
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
                last_active DATETIME DEFAULT CURRENT_TIMESTAMP
            )"
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        // Migration for existing databases
        let _ = sqlx::query("ALTER TABLE agents ADD COLUMN model TEXT").execute(&self.pool).await;
        let _ = sqlx::query("ALTER TABLE agents ADD COLUMN provider TEXT").execute(&self.pool).await;
        let _ = sqlx::query("ALTER TABLE agents ADD COLUMN burn_rate REAL DEFAULT 0.0").execute(&self.pool).await;
        let _ = sqlx::query("ALTER TABLE agents ADD COLUMN quality_score REAL DEFAULT 0.0").execute(&self.pool).await;

        // Health Logs Table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS health_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                check_type TEXT NOT NULL,
                status TEXT NOT NULL,
                details TEXT
            )"
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(())
    }
}
