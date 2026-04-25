use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::{command, AppHandle, Emitter};
use crate::project_scanner::UpgradeImpactReport;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub dependency: String,
    pub status: String,
    pub percentage: f32,
    pub message: String,
}

#[command]
pub async fn project_analyze_upgrade(
    _project_path: String,
    dependency: String,
) -> Result<UpgradeImpactReport, String> {
    // 1. Get current version
    let current_version = match dependency.as_str() {
        "rtk" => run_version_cmd("rtk"),
        "bd" | "beads" => run_version_cmd("bd"),
        "kspec" => run_version_cmd("kspec"),
        "gitnexus" => run_version_cmd("gitnexus"),
        _ => "unknown".to_string(),
    };

    // 2. Identify affected files and symbols (Mapping the "Assimilation Surface")
    let (files, symbols): (Vec<String>, Vec<String>) = match dependency.as_str() {
        "rtk" => (
            vec!["src-tauri/src/rtk_manager.rs".to_string(), "src-tauri/src/rtk_context.rs".to_string()],
            vec!["rtk_get_stats".to_string(), "rtk_get_history".to_string(), "rtk_check".to_string(), "rtk_optimize_context".to_string()]
        ),
        "bd" | "beads" => (
            vec!["src-tauri/src/orchestration.rs".to_string(), "src-tauri/src/project_scanner.rs".to_string()],
            vec!["beads_list".to_string(), "beads_show".to_string(), "beads_update".to_string(), "scan_project".to_string()]
        ),
        "kspec" => (
            vec!["src-tauri/src/orchestration.rs".to_string(), "src-tauri/src/project_scanner.rs".to_string()],
            vec!["kspec_list".to_string(), "kspec_dispatch_status".to_string()]
        ),
        "gitnexus" => (
            vec!["src-tauri/src/project_scanner.rs".to_string(), "src-tauri/src/project_intelligence.rs".to_string()],
            vec!["scan_project_intelligence".to_string(), "check_cli_health".to_string()]
        ),
        _ => (vec![], vec![]),
    };

    // 3. Risk Assessment & Blast Radius Analysis
    // In a real scenario, we would iterate through symbols and call `gitnexus impact`
    // For this phase, we perform a heuristic check of the internal dependency graph.
    let mut impact_details = Vec::new();
    let mut total_impacted = 0;

    for symbol in &symbols {
        if let Some(count) = get_symbol_impact_count(symbol) {
            impact_details.push(format!("{}: {} downstream consumers", symbol, count));
            total_impacted += count;
        }
    }

    let risk_level = if total_impacted > 10 {
        "HIGH"
    } else if total_impacted > 0 {
        "MEDIUM"
    } else {
        "LOW"
    };

    let blast_radius_summary = if symbols.is_empty() {
        format!("No direct 'Assimilation' symbols found for dependency '{}'. Upgrade is likely safe.", dependency)
    } else {
        format!(
            "Found {} integration symbols with {} estimated downstream consumers. Impact surface: {}.",
            symbols.len(),
            total_impacted,
            impact_details.join(", ")
        )
    };

    let recommendation = if risk_level == "HIGH" {
        format!("CRITICAL: Upgrading '{}' may break core workflows. Run a manual 'gitnexus_impact' on {} before proceeding.", dependency, symbols.join(", "))
    } else {
        format!("Ensure the new version of '{}' maintains CLI compatibility for the following files: {}.", dependency, files.join(", "))
    };

    Ok(UpgradeImpactReport {
        dependency,
        current_version,
        target_version: None,
        affected_files: files,
        affected_symbols: symbols,
        risk_level: risk_level.into(),
        blast_radius_summary,
        recommendation,
    })
}

fn run_version_cmd(bin: &str) -> String {
    Command::new(bin)
        .arg("--version")
        .output()
        .ok()
        .and_then(|o| {
            String::from_utf8_lossy(&o.stdout)
                .trim()
                .split_whitespace()
                .last()
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| "unknown".into())
}

fn get_symbol_impact_count(symbol: &str) -> Option<u32> {
    // Integration with GitNexus CLI
    // We attempt to run the CLI to get real-time graph data
    let output = Command::new("gitnexus")
        .arg("impact")
        .arg(symbol)
        .arg("--repo")
        .arg("simple-code-gui")
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8_lossy(&output.stdout);
    // Parse "impactedCount": N from the output (heuristic parsing if not JSON)
    if let Some(line) = text.lines().find(|l| l.contains("impactedCount")) {
        line.split(':')
            .last()?
            .trim()
            .trim_matches(',')
            .parse::<u32>()
            .ok()
    } else {
        None
    }
}

#[command]
pub async fn project_upgrade_dependency(
    app: AppHandle,
    dependency: String,
) -> Result<(), String> {
    // 1. Validate dependency
    let pkg_name = match dependency.as_str() {
        "rtk" => "rtk-cli",
        "bd" | "beads" => "beads-cli",
        "kspec" => "kspec-cli",
        "gitnexus" => "gitnexus",
        _ => return Err("Unsupported dependency for auto-upgrade".into()),
    };

    // 2. Emit start
    let _ = app.emit("upgrade-progress", ProgressPayload {
        dependency: dependency.clone(),
        status: "running".into(),
        percentage: 0.1,
        message: format!("Starting upgrade for {}...", dependency),
    });

    // 3. Execute npm install -g
    let output = Command::new("npm")
        .arg("install")
        .arg("-g")
        .arg(format!("{}@latest", pkg_name))
        .output()
        .map_err(|e| format!("Failed to execute npm: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        let _ = app.emit("upgrade-progress", ProgressPayload {
            dependency: dependency.clone(),
            status: "failed".into(),
            percentage: 1.0,
            message: format!("Upgrade failed: {}", err),
        });
        return Err(err);
    }

    // 4. Emit success
    let _ = app.emit("upgrade-progress", ProgressPayload {
        dependency: dependency.clone(),
        status: "completed".into(),
        percentage: 1.0,
        message: format!("Successfully upgraded {} to latest.", dependency),
    });

    Ok(())
}

#[command]
pub async fn project_rollback_dependency(
    app: AppHandle,
    dependency: String,
    version: String,
) -> Result<(), String> {
    let pkg_name = match dependency.as_str() {
        "rtk" => "rtk-cli",
        "bd" | "beads" => "beads-cli",
        "kspec" => "kspec-cli",
        "gitnexus" => "gitnexus",
        _ => return Err("Unsupported dependency for rollback".into()),
    };

    let _ = app.emit("upgrade-progress", ProgressPayload {
        dependency: dependency.clone(),
        status: "running".into(),
        percentage: 0.1,
        message: format!("Rolling back {} to version {}...", dependency, version),
    });

    let output = Command::new("npm")
        .arg("install")
        .arg("-g")
        .arg(format!("{}@{}", pkg_name, version))
        .output()
        .map_err(|e| format!("Failed to execute npm: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        let _ = app.emit("upgrade-progress", ProgressPayload {
            dependency: dependency.clone(),
            status: "failed".into(),
            percentage: 1.0,
            message: format!("Rollback failed: {}", err),
        });
        return Err(err);
    }

    let _ = app.emit("upgrade-progress", ProgressPayload {
        dependency: dependency.clone(),
        status: "completed".into(),
        percentage: 1.0,
        message: format!("Successfully rolled back {} to {}.", dependency, version),
    });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_analyze_rtk_upgrade() {
        // This test requires rtk to be in the PATH
        let result = project_analyze_upgrade(".".into(), "rtk".into()).await;
        assert!(result.is_ok());
        let report = result.unwrap();
        assert_eq!(report.dependency, "rtk");
        assert!(report.affected_files.contains(&"src-tauri/src/rtk_manager.rs".to_string()));
        assert!(report.affected_symbols.contains(&"rtk_get_stats".to_string()));
    }
}
