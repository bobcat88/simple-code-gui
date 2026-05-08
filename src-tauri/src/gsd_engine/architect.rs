use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use crate::gsd_engine::tools;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArchitectAuditReport {
    pub structural_drift: f64,
    pub graph_stability: f64,
    pub findings: Vec<ArchitectFinding>,
    pub timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArchitectFinding {
    pub id: String,
    pub severity: String, // "HIGH", "MEDIUM", "LOW"
    pub finding_type: String, // "COMPLEXITY", "CYCLE", "FAN_IN"
    pub title: String,
    pub description: String,
    pub file_path: String,
    pub symbol_name: String,
}

pub struct ArchitectEngine {
    pub app: AppHandle,
}

impl ArchitectEngine {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    pub async fn run_deep_audit(&self, project_path: &str) -> Result<ArchitectAuditReport, String> {
        // 1. Execute the multi-stage audit tools
        let audit_raw = tools::execute_tool("gsd_proactive_audit", "{}", &Some(project_path.to_string()), &self.app).await?;
        
        // 2. Parse findings from the tool output (currently semi-structured text)
        // For Phase 47, we'll implement basic parsing and heuristic scoring
        let mut findings = Vec::new();
        
        // Heuristic scoring for drift and stability
        let mut high_severity_count = 0;
        
        if audit_raw.contains("### Technical Debt") {
            // Mock parsing for now, to be improved with better gitnexus output
            findings.push(ArchitectFinding {
                id: uuid::Uuid::new_v4().to_string(),
                severity: "MEDIUM".to_string(),
                finding_type: "COMPLEXITY".to_string(),
                title: "Refactor Large Functions".to_string(),
                description: "Several functions exceed 200 lines, increasing maintenance risk.".to_string(),
                file_path: "multiple".to_string(),
                symbol_name: "multiple".to_string(),
            });
        }

        if audit_raw.contains("### Circular Dependency") {
            high_severity_count += 1;
            findings.push(ArchitectFinding {
                id: uuid::Uuid::new_v4().to_string(),
                severity: "HIGH".to_string(),
                finding_type: "CYCLE".to_string(),
                title: "Circular Dependencies Detected".to_string(),
                description: "Cyclical imports found between modules. This can cause build fragility.".to_string(),
                file_path: "multiple".to_string(),
                symbol_name: "multiple".to_string(),
            });
        }

        let structural_drift = (findings.len() as f64 * 0.05).min(1.0);
        let graph_stability = (1.0 - (high_severity_count as f64 * 0.2)).max(0.0);

        Ok(ArchitectAuditReport {
            structural_drift,
            graph_stability,
            findings,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        })
    }
}
