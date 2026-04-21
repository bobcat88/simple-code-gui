use serde::{Deserialize, Serialize};
use std::path::Path;
use chrono::Utc;

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProjectInitializationState {
    NotInitialized,
    PartiallyInitialized,
    FullyInitialized,
    ThirdPartyInitialized,
    ConflictingInitialization,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MarkerKind {
    File,
    Directory,
    Config,
    Command,
    Index,
    Generated,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MarkerStatus {
    Present,
    Missing,
    Unreadable,
    Stale,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Confidence {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SourceSystem {
    SimpleCodeGui,
    Beads,
    Kspec,
    Gsd,
    Rtk,
    Gitnexus,
    Mcp,
    Provider,
    Git,
    Terminal,
    User,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CapabilityKind {
    TaskBackend,
    SpecBackend,
    ExecutionWorkflow,
    RepoIntelligence,
    TokenOptimizer,
    McpServer,
    Provider,
    Voice,
    Updater,
    ProjectContract,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CapabilityMode {
    Full,
    Partial,
    InstructionOnly,
    Degraded,
    Disabled,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HealthStatus {
    Healthy,
    Warning,
    Error,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WarningSeverity {
    Info,
    Warning,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedMarker {
    pub id: String,
    pub kind: MarkerKind,
    pub path: Option<String>,
    pub source_system: SourceSystem,
    pub confidence: Confidence,
    pub status: MarkerStatus,
    pub mtime: Option<u64>,
    pub checksum: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityScanResult {
    pub id: String,
    pub kind: CapabilityKind,
    pub source_system: SourceSystem,
    pub installed: bool,
    pub initialized: bool,
    pub enabled: bool,
    pub mode: CapabilityMode,
    pub health: HealthStatus,
    pub health_score: f32, // Added health score (0.0-1.0)
    pub version: Option<String>,
    pub marker_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanWarning {
    pub id: String,
    pub severity: WarningSeverity,
    pub title: String,
    pub detail: String,
    pub marker_ids: Vec<String>,
    pub capability_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanBlocker {
    pub id: String,
    pub title: String,
    pub detail: String,
    pub marker_ids: Vec<String>,
    pub recommended_action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProposalPreset {
    Minimal,
    Standard,
    FullSpecDriven,
    Guarded,
    LocalFirst,
    ManualReview,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpgradeProposalInput {
    pub can_propose_minimal: bool,
    pub can_propose_standard: bool,
    pub can_propose_full: bool,
    pub recommended_preset: ProposalPreset,
    pub approval_score: f32, // Added formula result
    pub risk_profile: u32,    // Added formula result
    pub create_candidates: Vec<String>,
    pub modify_candidates: Vec<String>,
    pub preserve_candidates: Vec<String>,
    pub migration_sources: Vec<SourceSystem>,
    pub rollback_notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCapabilityScan {
    pub root_path: String,
    pub scanned_at: String,
    pub initialization_state: ProjectInitializationState,
    pub markers: Vec<DetectedMarker>,
    pub capabilities: Vec<CapabilityScanResult>,
    pub warnings: Vec<ScanWarning>,
    pub blockers: Vec<ScanBlocker>,
    pub upgrade_inputs: UpgradeProposalInput,
    pub total_file_count: u32,
    pub scan_duration_ms: u64,
    pub project_health_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanOptions {
    pub include_cli_health: Option<bool>,
    pub include_git_health: Option<bool>,
    pub max_depth: Option<u32>,
}

// ─── Scanner ─────────────────────────────────────────────────────────────────

// ─── Scanner ─────────────────────────────────────────────────────────────────

pub fn scan_project(root_path: &str, options: &ScanOptions) -> ProjectCapabilityScan {
    let start_time = std::time::Instant::now();
    let root = Path::new(root_path);
    let mut markers = Vec::new();
    let mut capabilities = Vec::new();
    let mut warnings = Vec::new();
    let mut blockers = Vec::new();
    let mut total_file_count = 0;

    let max_depth = options.max_depth.unwrap_or(3);

    // ── Recursive Marker Detection ──
    walk_and_detect(&root, &root, 0, max_depth, &mut markers, &mut total_file_count);

    // ── CLI Health Checks ──
    if options.include_cli_health.unwrap_or(true) {
        check_cli_health(&mut markers);
    }

    // ── Build capabilities ──
    let has = |id: &str| marker_present(&markers, id);

    // Simple Code GUI contract
    capabilities.push(CapabilityScanResult {
        id: "simplecode_project_contract".into(),
        kind: CapabilityKind::ProjectContract,
        source_system: SourceSystem::SimpleCodeGui,
        installed: has("simplecode_manifest"),
        initialized: has("simplecode_manifest") && has("simplecode_profile"),
        enabled: has("simplecode_manifest"),
        mode: if has("simplecode_manifest") && has("ai_contract") { CapabilityMode::Full } else if has("simplecode_manifest") { CapabilityMode::Partial } else { CapabilityMode::Disabled },
        health: if has("simplecode_manifest") { HealthStatus::Healthy } else { HealthStatus::Unknown },
        health_score: if has("simplecode_manifest") { 1.0 } else { 0.0 },
        version: None,
        marker_ids: vec!["simplecode_manifest".into(), "simplecode_profile".into(), "ai_contract".into()],
    });

    // Beads
    let beads_present = has("beads_dir");
    let beads_cli_present = has("beads_cli");
    capabilities.push(CapabilityScanResult {
        id: "beads_task_backend".into(),
        kind: CapabilityKind::TaskBackend,
        source_system: SourceSystem::Beads,
        installed: beads_present,
        initialized: beads_present,
        enabled: beads_present,
        mode: if beads_present && beads_cli_present { CapabilityMode::Full } else if beads_present { CapabilityMode::Degraded } else { CapabilityMode::Disabled },
        health: if beads_present && beads_cli_present { HealthStatus::Healthy } else if beads_present { HealthStatus::Warning } else { HealthStatus::Unknown },
        health_score: if beads_present && beads_cli_present { 1.0 } else if beads_present { 0.5 } else { 0.0 },
        version: None,
        marker_ids: vec!["beads_dir".into(), "beads_cli".into()],
    });

    // KSpec
    let kspec_has_worktree = has("kspec_worktree");
    let kspec_has_generated = has("kspec_agents_generated");
    let kspec_cli_present = has("kspec_cli");
    capabilities.push(CapabilityScanResult {
        id: "kspec_spec_backend".into(),
        kind: CapabilityKind::SpecBackend,
        source_system: SourceSystem::Kspec,
        installed: kspec_has_worktree || kspec_has_generated,
        initialized: kspec_has_worktree,
        enabled: kspec_has_worktree,
        mode: if kspec_has_worktree && kspec_cli_present { CapabilityMode::Full } else if kspec_has_worktree { CapabilityMode::Degraded } else if kspec_has_generated { CapabilityMode::InstructionOnly } else { CapabilityMode::Disabled },
        health: if kspec_has_worktree && kspec_cli_present { HealthStatus::Healthy } else if kspec_has_worktree || kspec_has_generated { HealthStatus::Warning } else { HealthStatus::Unknown },
        health_score: if kspec_has_worktree && kspec_cli_present { 1.0 } else if kspec_has_worktree { 0.7 } else if kspec_has_generated { 0.3 } else { 0.0 },
        version: None,
        marker_ids: vec!["kspec_worktree".into(), "kspec_agents_generated".into(), "kspec_cli".into()],
    });

    // RTK
    let rtk_installed = has("rtk_config") || has("rtk_rules");
    let rtk_cli_present = has("rtk_cli");
    capabilities.push(CapabilityScanResult {
        id: "rtk_token_optimizer".into(),
        kind: CapabilityKind::TokenOptimizer,
        source_system: SourceSystem::Rtk,
        installed: rtk_installed,
        initialized: has("rtk_config"),
        enabled: rtk_installed,
        mode: if has("rtk_config") && rtk_cli_present { CapabilityMode::Full } else if has("rtk_rules") { CapabilityMode::InstructionOnly } else { CapabilityMode::Disabled },
        health: if rtk_installed && rtk_cli_present { HealthStatus::Healthy } else if rtk_installed { HealthStatus::Warning } else { HealthStatus::Unknown },
        health_score: if rtk_installed && rtk_cli_present { 1.0 } else if rtk_installed { 0.5 } else { 0.0 },
        version: None,
        marker_ids: vec!["rtk_config".into(), "rtk_rules".into(), "rtk_cli".into()],
    });

    // ── Generate warnings ──
    if kspec_has_generated && !kspec_has_worktree {
        warnings.push(ScanWarning {
            id: "generated_kspec_without_worktree".into(),
            severity: WarningSeverity::Warning,
            title: "KSpec agents file without worktree".into(),
            detail: "kspec-agents.md exists but .kspec/ worktree is missing. Generated instructions may be stale.".into(),
            marker_ids: vec!["kspec_agents_generated".into()],
            capability_ids: vec!["kspec_spec_backend".into()],
        });
    }

    // ── Check for blockers ──
    if !root.exists() {
        blockers.push(ScanBlocker {
            id: "unreadable_project_root".into(),
            title: "Project root not found".into(),
            detail: format!("Path does not exist: {}", root_path),
            marker_ids: vec![],
            recommended_action: "Verify the project path exists and is accessible.".into(),
        });
    }

    // ── Classify initialization state ──
    let has_simplecode = has("simplecode_manifest");
    let has_ai = has("ai_contract");
    let has_agents = has("agents_contract");
    let has_task_or_spec = has("beads_dir") || kspec_has_worktree;
    let has_third_party = has("claude_contract") || has("claude_contract_dir") || has("codex_config")
        || kspec_has_worktree || has("beads_dir") || has("planning_dir");

    let initialization_state = if !blockers.is_empty() {
        ProjectInitializationState::ConflictingInitialization
    } else if has_simplecode && has_ai && has_agents && has_task_or_spec {
        ProjectInitializationState::FullyInitialized
    } else if has_simplecode {
        ProjectInitializationState::PartiallyInitialized
    } else if has_third_party {
        ProjectInitializationState::ThirdPartyInitialized
    } else {
        ProjectInitializationState::NotInitialized
    };

    // ── Formula Engine ──
    let blocker_count = blockers.len() as f32;
    let warning_count = warnings.len() as f32;
    let approval_score = (1.0 - (blocker_count * 0.5) - (warning_count * 0.05)).max(0.0);
    
    let mut risk_profile = 0;
    if !has_simplecode { risk_profile += 5; }
    if initialization_state == ProjectInitializationState::ConflictingInitialization { risk_profile += 10; }
    if !has("git_repo") { risk_profile += 3; }

    // ── Build upgrade proposal inputs ──
    let can_propose_minimal = blockers.is_empty();
    let can_propose_standard = blockers.is_empty();
    let can_propose_full = blockers.is_empty() && !matches!(initialization_state, ProjectInitializationState::ConflictingInitialization);

    let recommended_preset = if !blockers.is_empty() {
        ProposalPreset::ManualReview
    } else {
        match &initialization_state {
            ProjectInitializationState::NotInitialized => ProposalPreset::Standard,
            ProjectInitializationState::PartiallyInitialized => ProposalPreset::Standard,
            ProjectInitializationState::FullyInitialized => ProposalPreset::Minimal,
            ProjectInitializationState::ThirdPartyInitialized => ProposalPreset::Guarded,
            ProjectInitializationState::ConflictingInitialization => ProposalPreset::ManualReview,
        }
    };

    let mut create_candidates = Vec::new();
    let mut modify_candidates = Vec::new();
    let mut preserve_candidates = Vec::new();
    let mut migration_sources = Vec::new();

    if !has_simplecode { create_candidates.push(".simplecode/manifest.toml".into()); }
    if !has("simplecode_profile") { create_candidates.push(".simplecode/project-profile.json".into()); }
    if !has_ai { create_candidates.push("ai.md".into()); }
    if !has_agents { create_candidates.push("AGENTS.md".into()); }

    if has_ai { modify_candidates.push("ai.md".into()); }
    if has_agents { preserve_candidates.push("AGENTS.md".into()); }
    if has("beads_dir") { preserve_candidates.push(".beads/".into()); migration_sources.push(SourceSystem::Beads); }
    if kspec_has_worktree { preserve_candidates.push(".kspec/".into()); migration_sources.push(SourceSystem::Kspec); }

    let upgrade_inputs = UpgradeProposalInput {
        can_propose_minimal,
        can_propose_standard,
        can_propose_full,
        recommended_preset,
        approval_score,
        risk_profile,
        create_candidates,
        modify_candidates,
        preserve_candidates,
        migration_sources,
        rollback_notes: vec!["Created files can be safely deleted to rollback.".into()],
    };

    let project_health_score = calculate_project_health(&capabilities);

    ProjectCapabilityScan {
        root_path: root_path.to_string(),
        scanned_at: Utc::now().to_rfc3339(),
        initialization_state,
        markers,
        capabilities,
        warnings,
        blockers,
        upgrade_inputs,
        total_file_count: total_file_count as u32,
        scan_duration_ms: start_time.elapsed().as_millis() as u64,
        project_health_score,
    }
}

fn calculate_project_health(capabilities: &[CapabilityScanResult]) -> f32 {
    if capabilities.is_empty() { return 0.0; }
    let total_score: f32 = capabilities
        .iter()
        .map(|capability| capability.health_score.clamp(0.0, 1.0))
        .sum();
    (total_score / capabilities.len() as f32) * 100.0
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn walk_and_detect(
    root: &Path,
    current: &Path,
    depth: u32,
    max_depth: u32,
    markers: &mut Vec<DetectedMarker>,
    file_count: &mut usize,
) {
    if depth > max_depth { return; }

    if let Ok(entries) = std::fs::read_dir(current) {
        for entry in entries.flatten() {
            *file_count += 1;
            let path = entry.path();
            let rel_path = path.strip_prefix(root).unwrap_or(&path);
            let rel_str = rel_path.to_string_lossy();

            // Marker Detection
            match rel_str.as_ref() {
                ".simplecode/manifest.toml" => add_marker(markers, "simplecode_manifest", &path, &rel_str, MarkerKind::File, SourceSystem::SimpleCodeGui),
                ".simplecode/project-profile.json" => add_marker(markers, "simplecode_profile", &path, &rel_str, MarkerKind::File, SourceSystem::SimpleCodeGui),
                "ai.md" => add_marker(markers, "ai_contract", &path, &rel_str, MarkerKind::File, SourceSystem::SimpleCodeGui),
                "AGENTS.md" => add_marker(markers, "agents_contract", &path, &rel_str, MarkerKind::File, SourceSystem::SimpleCodeGui),
                "CLAUDE.md" | ".claude/CLAUDE.md" => add_marker(markers, "claude_contract", &path, &rel_str, MarkerKind::File, SourceSystem::Provider),
                ".kspec" => add_marker(markers, "kspec_worktree", &path, &rel_str, MarkerKind::Directory, SourceSystem::Kspec),
                "kspec-agents.md" => add_marker(markers, "kspec_agents_generated", &path, &rel_str, MarkerKind::Generated, SourceSystem::Kspec),
                ".beads" => add_marker(markers, "beads_dir", &path, &rel_str, MarkerKind::Directory, SourceSystem::Beads),
                ".git" => add_marker(markers, "git_repo", &path, &rel_str, MarkerKind::Directory, SourceSystem::Git),
                ".planning" => add_marker(markers, "planning_dir", &path, &rel_str, MarkerKind::Directory, SourceSystem::Gsd),
                ".rtk" => add_marker(markers, "rtk_config", &path, &rel_str, MarkerKind::Directory, SourceSystem::Rtk),
                _ => {}
            }

            if path.is_dir() && !rel_str.starts_with('.') {
                walk_and_detect(root, &path, depth + 1, max_depth, markers, file_count);
            }
        }
    }
}

fn add_marker(
    markers: &mut Vec<DetectedMarker>,
    id: &str,
    full_path: &Path,
    rel_path: &str,
    kind: MarkerKind,
    source_system: SourceSystem,
) {
    let mtime = std::fs::metadata(full_path).ok().and_then(|m| m.modified().ok()).and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs());
    
    markers.push(DetectedMarker {
        id: id.to_string(),
        kind,
        path: Some(rel_path.to_string()),
        source_system,
        confidence: Confidence::High,
        status: MarkerStatus::Present,
        mtime,
        checksum: None, // Checksum calculation deferred for performance
    });
}

fn check_cli_health(markers: &mut Vec<DetectedMarker>) {
    let clis = [
        ("bd", "beads_cli", SourceSystem::Beads),
        ("kspec", "kspec_cli", SourceSystem::Kspec),
        ("rtk", "rtk_cli", SourceSystem::Rtk),
        ("git", "git_cli", SourceSystem::Git),
    ];

    for (bin, id, system) in clis {
        let status = if std::process::Command::new(bin).arg("--version").output().is_ok() {
            MarkerStatus::Present
        } else {
            MarkerStatus::Missing
        };
        markers.push(DetectedMarker {
            id: id.to_string(),
            kind: MarkerKind::Command,
            path: None,
            source_system: system,
            confidence: Confidence::High,
            status,
            mtime: None,
            checksum: None,
        });
    }
}

fn marker_present(markers: &[DetectedMarker], id: &str) -> bool {
    markers.iter().any(|m| m.id == id && matches!(m.status, MarkerStatus::Present))
}

// ─── Proposal Engine ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OperationKind {
    CreateFile,
    CreateDirectory,
    ModifyFile,
    RunCommand,
    Preserve,
    Skip,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OperationRisk {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalOperation {
    pub id: String,
    pub kind: OperationKind,
    pub path: Option<String>,
    pub command: Option<String>,
    pub source_system: SourceSystem,
    pub reason: String,
    pub preview: Option<String>,
    pub risk: OperationRisk,
    pub requires_approval: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializationProposal {
    pub id: String,
    pub root_path: String,
    pub created_at: String,
    pub preset: ProposalPreset,
    pub summary: String,
    pub operations: Vec<ProposalOperation>,
    pub warnings: Vec<ScanWarning>,
    pub blockers: Vec<ScanBlocker>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalProgress {
    pub proposal_id: String,
    pub total_operations: usize,
    pub completed_operations: usize,
    pub current_operation_id: String,
    pub current_operation_name: String,
    pub status: String, // "running", "completed", "failed"
    pub message: String,
    pub error: Option<String>,
}

pub fn generate_proposal(
    scan: &ProjectCapabilityScan,
    preset: &ProposalPreset,
    project_name: &str,
    task_backend: &str,
    enabled_capability_ids: Option<Vec<String>>,
) -> InitializationProposal {
    let mut operations = Vec::new();
    let now = Utc::now().to_rfc3339();
    let proposal_id = uuid::Uuid::new_v4().to_string();

    let is_enabled = |cap_id: &str| {
        if let Some(ref ids) = enabled_capability_ids {
            ids.contains(&cap_id.to_string())
        } else {
            true
        }
    };

    // ── Pre-Calculated Risk & Approval ──
    let requires_manual_review = scan.upgrade_inputs.approval_score < 0.8 || *preset == ProposalPreset::ManualReview || *preset == ProposalPreset::Guarded;

    // ── 1. Root & Registration ──
    if !marker_present(&scan.markers, "simplecode_manifest") && is_enabled("simplecode_project_contract") {
        operations.push(ProposalOperation {
            id: "create_simplecode_dir".into(),
            kind: OperationKind::CreateDirectory,
            path: Some(".simplecode".into()),
            command: None,
            source_system: SourceSystem::SimpleCodeGui,
            reason: "Project registration directory".into(),
            preview: None,
            risk: OperationRisk::Low,
            requires_approval: false,
        });

        let manifest_content = format!(
            r#"version = 1
project_id = "{}"
root_path = "{}"
initialized_at = "{}"
preset = "{}"
task_backend = "{}"
spec_backend = "{}"

[capabilities]
beads = {}
kspec = {}
gsd = false
rtk = false
gitnexus = false
mcp = {}
"#,
            proposal_id,
            scan.root_path,
            now,
            preset_to_str(preset),
            task_backend,
            if task_backend == "kspec" { "kspec" } else { "none" },
            task_backend == "beads",
            task_backend == "kspec",
            *preset != ProposalPreset::LocalFirst,
        );

        operations.push(ProposalOperation {
            id: "create_manifest".into(),
            kind: OperationKind::CreateFile,
            path: Some(".simplecode/manifest.toml".into()),
            command: None,
            source_system: SourceSystem::SimpleCodeGui,
            reason: "Machine-readable project initialization record".into(),
            preview: Some(manifest_content),
            risk: OperationRisk::Low,
            requires_approval: false,
        });

        let profile_content = format!(
            r#"{{
  "version": 1,
  "projectId": "{}",
  "displayName": "{}",
  "defaultProviderPlanId": "balanced",
  "enabledCapabilityIds": [],
  "createdAt": "{}",
  "updatedAt": "{}"
}}"#,
            proposal_id, project_name, now, now
        );

        operations.push(ProposalOperation {
            id: "create_profile".into(),
            kind: OperationKind::CreateFile,
            path: Some(".simplecode/project-profile.json".into()),
            command: None,
            source_system: SourceSystem::SimpleCodeGui,
            reason: "App-owned UI projection and defaults".into(),
            preview: Some(profile_content),
            risk: OperationRisk::Low,
            requires_approval: false,
        });
    }

    // ── 2. AI & Agent Contracts (Standard+) ──
    if !matches!(preset, ProposalPreset::Minimal) {
        if !marker_present(&scan.markers, "ai_contract") && is_enabled("simplecode_project_contract") {
            let ai_content = format!(
                r#"# {} — AI Contract

## Project Intent
<!-- Describe what this project does and its goals -->

## Coding Standards
<!-- Define coding conventions, style guides, testing requirements -->

## Task & Spec Source of Truth
- Backend: {}

## Provider Routing
- Default: balanced

## Approval Policy
- Destructive operations require confirmation
- File mutations require review
"#,
                project_name, task_backend
            );

            operations.push(ProposalOperation {
                id: "create_ai_contract".into(),
                kind: OperationKind::CreateFile,
                path: Some("ai.md".into()),
                command: None,
                source_system: SourceSystem::SimpleCodeGui,
                reason: "Human-readable local AI contract".into(),
                preview: Some(ai_content),
                risk: OperationRisk::Low,
                requires_approval: false,
            });
        }

        if !marker_present(&scan.markers, "agents_contract") {
            operations.push(ProposalOperation {
                id: "create_agents".into(),
                kind: OperationKind::CreateFile,
                path: Some("AGENTS.md".into()),
                command: None,
                source_system: SourceSystem::SimpleCodeGui,
                reason: "Agent-facing workflow instructions".into(),
                preview: Some(format!("# {} — Agent Instructions\n\n## Workflow\n\nRefer to project-specific tooling and task backend for workflow details.\n", project_name)),
                risk: OperationRisk::Low,
                requires_approval: false,
            });
        }
    }

    // ── 3. Tooling Initialization (Standard/Full) ──
    if matches!(preset, ProposalPreset::Standard | ProposalPreset::FullSpecDriven | ProposalPreset::Guarded) {
        // Git
        if !marker_present(&scan.markers, "git_repo") {
            operations.push(ProposalOperation {
                id: "git_init".into(),
                kind: OperationKind::RunCommand,
                path: None,
                command: Some("git init".into()),
                source_system: SourceSystem::Git,
                reason: "Initialize git repository".into(),
                preview: None,
                risk: OperationRisk::Low,
                requires_approval: requires_manual_review,
            });
        }

        // Task Backend
        if task_backend == "kspec" && !marker_present(&scan.markers, "kspec_worktree") && is_enabled("kspec_spec_backend") {
            operations.push(ProposalOperation {
                id: "kspec_init".into(),
                kind: OperationKind::RunCommand,
                path: None,
                command: Some("kspec init".into()),
                source_system: SourceSystem::Kspec,
                reason: "Initialize KSpec spec/task backend".into(),
                preview: None,
                risk: OperationRisk::Medium,
                requires_approval: true,
            });
        } else if task_backend == "beads" && !marker_present(&scan.markers, "beads_dir") && is_enabled("beads_task_backend") {
            operations.push(ProposalOperation {
                id: "beads_init".into(),
                kind: OperationKind::RunCommand,
                path: None,
                command: Some("bd init".into()),
                source_system: SourceSystem::Beads,
                reason: "Initialize Beads task backend".into(),
                preview: None,
                risk: OperationRisk::Medium,
                requires_approval: true,
            });
        }

        // RTK
        if *preset == ProposalPreset::FullSpecDriven && !marker_present(&scan.markers, "rtk_config") {
             operations.push(ProposalOperation {
                id: "rtk_gain".into(),
                kind: OperationKind::RunCommand,
                path: None,
                command: Some("rtk gain".into()),
                source_system: SourceSystem::Rtk,
                reason: "Initialize RTK token optimizer".into(),
                preview: None,
                risk: OperationRisk::Low,
                requires_approval: true,
            });
        }
    }

    // ── 4. Preservations ──
    for preserve in &scan.upgrade_inputs.preserve_candidates {
        operations.push(ProposalOperation {
            id: format!("preserve_{}", preserve.replace('/', "_").replace('.', "")),
            kind: OperationKind::Preserve,
            path: Some(preserve.clone()),
            command: None,
            source_system: SourceSystem::User,
            reason: format!("Existing {} preserved", preserve),
            preview: None,
            risk: OperationRisk::Low,
            requires_approval: false,
        });
    }

    let summary = format!(
        "{} initialization ({}): {} creates, {} commands, {} preserved. Risk Profile: {}. Approval Score: {:.2}",
        project_name,
        preset_to_str(preset),
        operations.iter().filter(|o| matches!(o.kind, OperationKind::CreateFile | OperationKind::CreateDirectory)).count(),
        operations.iter().filter(|o| matches!(o.kind, OperationKind::RunCommand)).count(),
        operations.iter().filter(|o| matches!(o.kind, OperationKind::Preserve)).count(),
        scan.upgrade_inputs.risk_profile,
        scan.upgrade_inputs.approval_score,
    );

    InitializationProposal {
        id: proposal_id,
        root_path: scan.root_path.clone(),
        created_at: now,
        preset: preset.clone(),
        summary,
        operations,
        warnings: scan.warnings.clone(),
        blockers: scan.blockers.clone(),
    }
}

/// Apply a proposal: execute file creates, directory creates, and commands.
pub fn apply_proposal(app: &tauri::AppHandle, proposal: &InitializationProposal) -> Result<Vec<String>, String> {
    use tauri::Emitter;
    let root = Path::new(&proposal.root_path);
    let mut applied = Vec::new();
    let total = proposal.operations.len();

    // Ensure root exists
    if !root.exists() {
        std::fs::create_dir_all(root).map_err(|e| format!("Failed to create root: {}", e))?;
        applied.push(format!("Created root directory: {}", proposal.root_path));
    }

    for (index, op) in proposal.operations.iter().enumerate() {
        let op_name = match op.kind {
            OperationKind::CreateDirectory => format!("Creating directory: {}", op.path.as_deref().unwrap_or("")),
            OperationKind::CreateFile => format!("Creating file: {}", op.path.as_deref().unwrap_or("")),
            OperationKind::RunCommand => format!("Running command: {}", op.command.as_deref().unwrap_or("")),
            OperationKind::ModifyFile => format!("Modifying file: {}", op.path.as_deref().unwrap_or("")),
            OperationKind::Preserve => format!("Preserving: {}", op.path.as_deref().unwrap_or("")),
            OperationKind::Skip => format!("Skipping: {}", op.path.as_deref().unwrap_or("")),
        };

        let progress = ProposalProgress {
            proposal_id: proposal.id.clone(),
            total_operations: total,
            completed_operations: index,
            current_operation_id: op.id.clone(),
            current_operation_name: op_name.clone(),
            status: "running".into(),
            message: format!("Step {}/{}: {}", index + 1, total, op_name),
            error: None,
        };
        let _ = app.emit("project-initialization-progress", progress);

        match op.kind {
            OperationKind::CreateDirectory => {
                if let Some(ref path) = op.path {
                    let full = root.join(path);
                    if !full.exists() {
                        std::fs::create_dir_all(&full)
                            .map_err(|e| format!("Failed to create dir {}: {}", path, e))?;
                        applied.push(format!("Created directory: {}", path));
                    }
                }
            }
            OperationKind::CreateFile => {
                if let Some(ref path) = op.path {
                    let full = root.join(path);
                    if !full.exists() {
                        if let Some(parent) = full.parent() {
                            std::fs::create_dir_all(parent)
                                .map_err(|e| format!("Failed to create parent for {}: {}", path, e))?;
                        }
                        if let Some(ref content) = op.preview {
                            std::fs::write(&full, content)
                                .map_err(|e| format!("Failed to write {}: {}", path, e))?;
                        } else {
                            std::fs::write(&full, "")
                                .map_err(|e| format!("Failed to write {}: {}", path, e))?;
                        }
                        applied.push(format!("Created file: {}", path));
                    }
                }
            }
            OperationKind::RunCommand => {
                if let Some(ref cmd) = op.command {
                    let output = std::process::Command::new("sh")
                        .arg("-c")
                        .arg(cmd)
                        .current_dir(root)
                        .output()
                        .map_err(|e| format!("Failed to run '{}': {}", cmd, e))?;
                    if output.status.success() {
                        applied.push(format!("Ran command: {}", cmd));
                    } else {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        let err_msg = format!("Command '{}' failed: {}", cmd, stderr.trim());
                        applied.push(err_msg.clone());
                        
                        let _ = app.emit("project-initialization-progress", ProposalProgress {
                            proposal_id: proposal.id.clone(),
                            total_operations: total,
                            completed_operations: index,
                            current_operation_id: op.id.clone(),
                            current_operation_name: op_name.clone(),
                            status: "failed".into(),
                            message: err_msg,
                            error: Some(stderr.to_string()),
                        });
                    }
                }
            }
            OperationKind::ModifyFile => {
                if let Some(ref path) = op.path {
                    let full = root.join(path);
                    if full.exists() {
                        if let Some(ref content) = op.preview {
                            let mut existing = std::fs::read_to_string(&full)
                                .map_err(|e| format!("Failed to read {}: {}", path, e))?;
                            if !existing.contains(content) {
                                if !existing.ends_with('\n') {
                                    existing.push('\n');
                                }
                                existing.push_str(content);
                                std::fs::write(&full, existing)
                                    .map_err(|e| format!("Failed to update {}: {}", path, e))?;
                                applied.push(format!("Modified file: {}", path));
                            } else {
                                applied.push(format!("File {} already contains changes", path));
                            }
                        }
                    }
                }
            }
            OperationKind::Preserve | OperationKind::Skip => {
                // No-op
            }
        }
    }

    // Final "completed" event
    let _ = app.emit("project-initialization-progress", ProposalProgress {
        proposal_id: proposal.id.clone(),
        total_operations: total,
        completed_operations: total,
        current_operation_id: "final".into(),
        current_operation_name: "Initialization Complete".into(),
        status: "completed".into(),
        message: "Project successfully initialized".into(),
        error: None,
    });

    Ok(applied)
}

#[tauri::command]
pub async fn project_scan(path: String, options: ScanOptions) -> Result<ProjectCapabilityScan, String> {
    Ok(scan_project(&path, &options))
}

#[tauri::command]
pub async fn project_generate_proposal(
    scan: ProjectCapabilityScan,
    preset: ProposalPreset,
    project_name: String,
    task_backend: String,
    enabled_capability_ids: Option<Vec<String>>,
) -> Result<InitializationProposal, String> {
    Ok(generate_proposal(&scan, &preset, &project_name, &task_backend, enabled_capability_ids))
}

#[tauri::command]
pub async fn project_apply_proposal(
    app: tauri::AppHandle,
    proposal: InitializationProposal
) -> Result<Vec<String>, String> {
    apply_proposal(&app, &proposal)
}

fn preset_to_str(preset: &ProposalPreset) -> &str {
    match preset {
        ProposalPreset::Minimal => "minimal",
        ProposalPreset::Standard => "standard",
        ProposalPreset::FullSpecDriven => "full_spec_driven",
        ProposalPreset::Guarded => "guarded",
        ProposalPreset::LocalFirst => "local_first",
        ProposalPreset::ManualReview => "manual_review",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn capability_with_health_score(id: &str, health_score: f32) -> CapabilityScanResult {
        CapabilityScanResult {
            id: id.to_string(),
            kind: CapabilityKind::TaskBackend,
            source_system: SourceSystem::SimpleCodeGui,
            installed: true,
            initialized: true,
            enabled: true,
            mode: CapabilityMode::Full,
            health: HealthStatus::Healthy,
            health_score,
            version: None,
            marker_ids: Vec::new(),
        }
    }

    fn assert_nearly_eq(actual: f32, expected: f32) {
        assert!(
            (actual - expected).abs() < f32::EPSILON,
            "expected {expected}, got {actual}"
        );
    }

    #[test]
    fn project_health_score_averages_capability_health_scores() {
        let capabilities = vec![
            capability_with_health_score("low", 0.25),
            capability_with_health_score("high", 0.75),
            capability_with_health_score("over_max", 1.5),
            capability_with_health_score("under_min", -1.0),
        ];

        assert_nearly_eq(calculate_project_health(&capabilities), 50.0);
    }

    #[test]
    fn scan_output_includes_metric_fields_with_serialized_contract() {
        let root = std::env::temp_dir().join(format!(
            "simple-code-gui-scanner-test-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(root.join("nested")).expect("create temp scanner fixture");
        fs::write(root.join("README.md"), "fixture").expect("write root fixture file");
        fs::write(root.join("nested").join("notes.md"), "fixture")
            .expect("write nested fixture file");
        fs::create_dir(root.join(".beads")).expect("create beads marker");

        let scan = scan_project(
            root.to_str().expect("temp path is valid UTF-8"),
            &ScanOptions {
                include_cli_health: Some(false),
                include_git_health: Some(false),
                max_depth: Some(2),
            },
        );

        let expected_health_score = calculate_project_health(&scan.capabilities);
        assert_nearly_eq(scan.project_health_score, expected_health_score);
        assert!(scan.total_file_count >= 4);

        let serialized = serde_json::to_value(&scan).expect("serialize scan output");
        assert!(serialized.get("totalFileCount").is_some());
        assert!(serialized.get("scanDurationMs").is_some());
        assert!(serialized.get("projectHealthScore").is_some());
        assert!(serialized.get("total_file_count").is_none());
        assert!(serialized.get("scan_duration_ms").is_none());
        assert!(serialized.get("project_health_score").is_none());

        fs::remove_dir_all(root).expect("remove temp scanner fixture");
    }
}
