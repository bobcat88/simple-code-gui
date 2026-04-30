use std::process::Command;
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::gsd_engine::knowledge::SwarmMemory;

pub struct ForensicAgent {
    memory: Arc<Mutex<Option<SwarmMemory>>>,
}

impl ForensicAgent {
    pub fn new(memory: Arc<Mutex<Option<SwarmMemory>>>) -> Self {
        Self { memory }
    }

    /// Analyze a forensic branch and index findings
    pub async fn analyze_branch(&self, project_path: &str, branch_name: &str) -> Result<String, String> {
        // 1. Get the diff from the forensic branch compared to its base (or just the branch itself)
        let output = Command::new("git")
            .args(["diff", "main...", branch_name])
            .current_dir(project_path)
            .output()
            .map_err(|e| e.to_string())?;

        let diff = String::from_utf8_lossy(&output.stdout);
        
        // 2. Perform forensic reasoning (In a real scenario, this would call an LLM)
        // For now, we'll simulate the reasoning logic
        let report = self.generate_forensic_report(&diff).await;

        // 3. Index the finding
        let memory = self.memory.lock().await;
        if let Some(mem) = memory.as_ref() {
            let meta = serde_json::json!({
                "branch": branch_name,
                "timestamp": std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
            }).to_string();

            mem.record("failure", branch_name, &report, &meta)
                .map_err(|e| e.to_string())?;
        }

        Ok(report)
    }

    async fn generate_forensic_report(&self, diff: &str) -> String {
        // Simulated reasoning: extract common failure patterns from diff
        if diff.contains("Unresolved dependency") {
            "Root Cause: Circular dependency in module graph. Action: Refactor imports in the affected wave." .to_string()
        } else if diff.contains("Timeout") {
            "Root Cause: Network latency or hung subprocess. Action: Increase timeout budget for this task category." .to_string()
        } else {
            format!("Forensic analysis complete. Extracted {} lines of structural changes. Recommended retry with higher context window.", diff.lines().count())
        }
    }
}
