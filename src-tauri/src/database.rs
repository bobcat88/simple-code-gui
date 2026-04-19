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

        Ok(())
    }
}
