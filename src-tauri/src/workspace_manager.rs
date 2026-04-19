use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{AppHandle, Manager};
use std::sync::Arc;
use crate::database::DatabaseManager;

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub category_id: Option<String>,
    pub last_accessed: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct ProjectCategory {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Workspace {
    pub projects: Vec<Project>,
    pub categories: Vec<ProjectCategory>,
}

pub struct WorkspaceManager {
    db: Arc<DatabaseManager>,
}

impl WorkspaceManager {
    pub async fn new(app: &AppHandle, db: Arc<DatabaseManager>) -> Self {
        let path = app.path().app_config_dir().unwrap().join("workspace.json");
        
        // Check if DB is already populated
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM projects")
            .fetch_one(&db.pool)
            .await
            .unwrap_or((0,));

        if count.0 == 0 && path.exists() {
            // Migrate from JSON
            let content = fs::read_to_string(&path).unwrap_or_default();
            let workspace: Workspace = serde_json::from_str(&content).unwrap_or_default();
            
            for project in workspace.projects {
                sqlx::query("INSERT INTO projects (id, name, path, category_id, last_accessed) VALUES (?, ?, ?, ?, ?)")
                    .bind(project.id)
                    .bind(project.name)
                    .bind(project.path)
                    .bind(project.category_id)
                    .bind(project.last_accessed)
                    .execute(&db.pool)
                    .await
                    .ok();
            }

            for category in workspace.categories {
                sqlx::query("INSERT INTO categories (id, name, color) VALUES (?, ?, ?)")
                    .bind(category.id)
                    .bind(category.name)
                    .bind(category.color)
                    .execute(&db.pool)
                    .await
                    .ok();
            }
            
            // Rename old file
            let mut new_path = path.clone();
            new_path.set_extension("json.bak");
            fs::rename(path, new_path).ok();
        }

        Self { db }
    }

    pub async fn get(&self) -> Workspace {
        let projects = sqlx::query_as::<_, Project>("SELECT id, name, path, category_id, last_accessed FROM projects")
            .fetch_all(&self.db.pool)
            .await
            .unwrap_or_default();

        let categories = sqlx::query_as::<_, ProjectCategory>("SELECT id, name, color FROM categories")
            .fetch_all(&self.db.pool)
            .await
            .unwrap_or_default();

        Workspace { projects, categories }
    }

    pub async fn save(&self, new_workspace: Workspace) -> Result<(), String> {
        // This is a "full sync" save from the frontend. 
        // In a real app we'd have add_project, delete_project, etc commands.
        // For now, to match existing API, we'll clear and re-insert or use a transaction.
        
        let mut tx = self.db.pool.begin().await.map_err(|e| e.to_string())?;

        sqlx::query("DELETE FROM projects").execute(&mut *tx).await.map_err(|e| e.to_string())?;
        sqlx::query("DELETE FROM categories").execute(&mut *tx).await.map_err(|e| e.to_string())?;

        for project in new_workspace.projects {
            sqlx::query("INSERT INTO projects (id, name, path, category_id, last_accessed) VALUES (?, ?, ?, ?, ?)")
                .bind(project.id)
                .bind(project.name)
                .bind(project.path)
                .bind(project.category_id)
                .bind(project.last_accessed)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
        }

        for category in new_workspace.categories {
            sqlx::query("INSERT INTO categories (id, name, color) VALUES (?, ?, ?)")
                .bind(category.id)
                .bind(category.name)
                .bind(category.color)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
        }

        tx.commit().await.map_err(|e| e.to_string())?;
        Ok(())
    }
}

