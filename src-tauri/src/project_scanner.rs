use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use chrono::Utc;

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProjectInitializationState {
    NotInitialized,
    PartiallyInitialized,
    FullyInitialized,
    ThirdPartyInitialized,
    ConflictingInitialization,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MarkerKind {
    File,
    Directory,
    Config,
    Command,
    Index,
    Generated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MarkerStatus {
    Present,
    Missing,
    Unreadable,
    Stale,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Confidence {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CapabilityMode {
    Full,
    Partial,
    InstructionOnly,
    Degraded,
    Disabled,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HealthStatus {
    Healthy,
    Warning,
    Error,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanOptions {
    pub include_cli_health: Option<bool>,
    pub include_git_health: Option<bool>,
    pub max_depth: Option<u32>,
}

// ─── Scanner ─────────────────────────────────────────────────────────────────

pub fn scan_project(root_path: &str, _options: &ScanOptions) -> ProjectCapabilityScan {
    let root = Path::new(root_path);
    let mut markers = Vec::new();
    let mut capabilities = Vec::new();
    let mut warnings = Vec::new();
    let mut blockers = Vec::new();

    // ── Detect markers ──
    detect_marker(&root, &mut markers, "simplecode_manifest", ".simplecode/manifest.toml", MarkerKind::File, SourceSystem::SimpleCodeGui);
    detect_marker(&root, &mut markers, "simplecode_profile", ".simplecode/project-profile.json", MarkerKind::File, SourceSystem::SimpleCodeGui);
    detect_marker(&root, &mut markers, "ai_contract", "ai.md", MarkerKind::File, SourceSystem::SimpleCodeGui);
    detect_marker(&root, &mut markers, "agents_contract", "AGENTS.md", MarkerKind::File, SourceSystem::SimpleCodeGui);
    detect_marker(&root, &mut markers, "claude_contract", "CLAUDE.md", MarkerKind::File, SourceSystem::Provider);
    detect_marker(&root, &mut markers, "claude_contract_dir", ".claude/CLAUDE.md", MarkerKind::File, SourceSystem::Provider);
    detect_marker(&root, &mut markers, "claude_settings", ".claude/settings.json", MarkerKind::File, SourceSystem::Provider);
    detect_marker(&root, &mut markers, "kspec_worktree", ".kspec", MarkerKind::Directory, SourceSystem::Kspec);
    detect_marker(&root, &mut markers, "kspec_agents_generated", "kspec-agents.md", MarkerKind::Generated, SourceSystem::Kspec);
    detect_marker(&root, &mut markers, "beads_dir", ".beads", MarkerKind::Directory, SourceSystem::Beads);
    detect_marker(&root, &mut markers, "gitnexus_store", ".gitnexus", MarkerKind::Directory, SourceSystem::Gitnexus);
    detect_marker(&root, &mut markers, "gitnexus_index", ".gitnexus/meta.json", MarkerKind::File, SourceSystem::Gitnexus);
    detect_marker(&root, &mut markers, "rtk_config", ".rtk", MarkerKind::Directory, SourceSystem::Rtk);
    detect_marker(&root, &mut markers, "rtk_rules", ".agents/rules/antigravity-rtk-rules.md", MarkerKind::File, SourceSystem::Rtk);
    detect_marker(&root, &mut markers, "gsd_project", "PROJECT.md", MarkerKind::File, SourceSystem::Gsd);
    detect_marker(&root, &mut markers, "gsd_roadmap", "ROADMAP.md", MarkerKind::File, SourceSystem::Gsd);
    detect_marker(&root, &mut markers, "planning_dir", ".planning", MarkerKind::Directory, SourceSystem::Gsd);
    detect_marker(&root, &mut markers, "mcp_project_config", ".mcp", MarkerKind::Directory, SourceSystem::Mcp);
    detect_marker(&root, &mut markers, "mcp_claude_config", ".claude/mcp_config.json", MarkerKind::File, SourceSystem::Mcp);
    detect_marker(&root, &mut markers, "codex_config", ".codex", MarkerKind::Directory, SourceSystem::Provider);
    detect_marker(&root, &mut markers, "git_repo", ".git", MarkerKind::Directory, SourceSystem::Git);
    detect_marker(&root, &mut markers, "package_json", "package.json", MarkerKind::File, SourceSystem::User);
    detect_marker(&root, &mut markers, "cargo_manifest", "Cargo.toml", MarkerKind::File, SourceSystem::User);
    detect_marker(&root, &mut markers, "cargo_manifest_tauri", "src-tauri/Cargo.toml", MarkerKind::File, SourceSystem::User);
    detect_marker(&root, &mut markers, "env_file", ".env", MarkerKind::File, SourceSystem::User);

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
        version: None,
        marker_ids: vec!["simplecode_manifest".into(), "simplecode_profile".into(), "ai_contract".into()],
    });

    // Agent instructions
    capabilities.push(CapabilityScanResult {
        id: "agents_instructions".into(),
        kind: CapabilityKind::ProjectContract,
        source_system: SourceSystem::SimpleCodeGui,
        installed: has("agents_contract"),
        initialized: has("agents_contract"),
        enabled: has("agents_contract"),
        mode: if has("agents_contract") { CapabilityMode::Full } else { CapabilityMode::Disabled },
        health: if has("agents_contract") { HealthStatus::Healthy } else { HealthStatus::Unknown },
        version: None,
        marker_ids: vec!["agents_contract".into()],
    });

    // Claude instructions
    capabilities.push(CapabilityScanResult {
        id: "claude_instructions".into(),
        kind: CapabilityKind::ProjectContract,
        source_system: SourceSystem::Provider,
        installed: has("claude_contract") || has("claude_contract_dir"),
        initialized: has("claude_contract") || has("claude_contract_dir"),
        enabled: has("claude_contract") || has("claude_contract_dir"),
        mode: if has("claude_contract") || has("claude_contract_dir") { CapabilityMode::Full } else { CapabilityMode::Disabled },
        health: HealthStatus::Unknown,
        version: None,
        marker_ids: vec!["claude_contract".into(), "claude_contract_dir".into()],
    });

    // Beads
    capabilities.push(CapabilityScanResult {
        id: "beads_task_backend".into(),
        kind: CapabilityKind::TaskBackend,
        source_system: SourceSystem::Beads,
        installed: has("beads_dir"),
        initialized: has("beads_dir"),
        enabled: has("beads_dir"),
        mode: if has("beads_dir") { CapabilityMode::Full } else { CapabilityMode::Disabled },
        health: if has("beads_dir") { HealthStatus::Healthy } else { HealthStatus::Unknown },
        version: None,
        marker_ids: vec!["beads_dir".into()],
    });

    // KSpec
    let kspec_has_worktree = has("kspec_worktree");
    let kspec_has_generated = has("kspec_agents_generated");
    capabilities.push(CapabilityScanResult {
        id: "kspec_spec_backend".into(),
        kind: CapabilityKind::SpecBackend,
        source_system: SourceSystem::Kspec,
        installed: kspec_has_worktree || kspec_has_generated,
        initialized: kspec_has_worktree,
        enabled: kspec_has_worktree,
        mode: if kspec_has_worktree { CapabilityMode::Full } else if kspec_has_generated { CapabilityMode::InstructionOnly } else { CapabilityMode::Disabled },
        health: if kspec_has_worktree { HealthStatus::Healthy } else if kspec_has_generated { HealthStatus::Warning } else { HealthStatus::Unknown },
        version: None,
        marker_ids: vec!["kspec_worktree".into(), "kspec_agents_generated".into()],
    });

    // GSD
    let gsd_installed = has("gsd_project") || has("planning_dir");
    capabilities.push(CapabilityScanResult {
        id: "gsd_execution_workflow".into(),
        kind: CapabilityKind::ExecutionWorkflow,
        source_system: SourceSystem::Gsd,
        installed: gsd_installed,
        initialized: gsd_installed,
        enabled: gsd_installed,
        mode: if gsd_installed { CapabilityMode::Full } else { CapabilityMode::Disabled },
        health: if gsd_installed { HealthStatus::Healthy } else { HealthStatus::Unknown },
        version: None,
        marker_ids: vec!["gsd_project".into(), "planning_dir".into()],
    });

    // RTK
    let rtk_installed = has("rtk_config") || has("rtk_rules");
    capabilities.push(CapabilityScanResult {
        id: "rtk_token_optimizer".into(),
        kind: CapabilityKind::TokenOptimizer,
        source_system: SourceSystem::Rtk,
        installed: rtk_installed,
        initialized: has("rtk_config"),
        enabled: rtk_installed,
        mode: if has("rtk_config") { CapabilityMode::Full } else if has("rtk_rules") { CapabilityMode::InstructionOnly } else { CapabilityMode::Disabled },
        health: if rtk_installed { HealthStatus::Healthy } else { HealthStatus::Unknown },
        version: None,
        marker_ids: vec!["rtk_config".into(), "rtk_rules".into()],
    });

    // GitNexus
    capabilities.push(CapabilityScanResult {
        id: "gitnexus_repo_intelligence".into(),
        kind: CapabilityKind::RepoIntelligence,
        source_system: SourceSystem::Gitnexus,
        installed: has("gitnexus_store"),
        initialized: has("gitnexus_index"),
        enabled: has("gitnexus_index"),
        mode: if has("gitnexus_index") { CapabilityMode::Full } else if has("gitnexus_store") { CapabilityMode::Partial } else { CapabilityMode::Disabled },
        health: if has("gitnexus_index") { HealthStatus::Healthy } else { HealthStatus::Unknown },
        version: None,
        marker_ids: vec!["gitnexus_store".into(), "gitnexus_index".into()],
    });

    // MCP
    let mcp_installed = has("mcp_project_config") || has("mcp_claude_config");
    capabilities.push(CapabilityScanResult {
        id: "mcp_bridge".into(),
        kind: CapabilityKind::McpServer,
        source_system: SourceSystem::Mcp,
        installed: mcp_installed,
        initialized: mcp_installed,
        enabled: mcp_installed,
        mode: if mcp_installed { CapabilityMode::Full } else { CapabilityMode::Disabled },
        health: if mcp_installed { HealthStatus::Healthy } else { HealthStatus::Unknown },
        version: None,
        marker_ids: vec!["mcp_project_config".into(), "mcp_claude_config".into()],
    });

    // Git
    capabilities.push(CapabilityScanResult {
        id: "git_repository".into(),
        kind: CapabilityKind::ProjectContract,
        source_system: SourceSystem::Git,
        installed: has("git_repo"),
        initialized: has("git_repo"),
        enabled: has("git_repo"),
        mode: if has("git_repo") { CapabilityMode::Full } else { CapabilityMode::Disabled },
        health: if has("git_repo") { HealthStatus::Healthy } else { HealthStatus::Unknown },
        version: None,
        marker_ids: vec!["git_repo".into()],
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

    if has("beads_dir") && !kspec_has_worktree {
        warnings.push(ScanWarning {
            id: "beads_without_spec_backend".into(),
            severity: WarningSeverity::Info,
            title: "Beads without spec backend".into(),
            detail: "Beads task backend exists without a spec backend. Consider adding KSpec for spec-driven workflow.".into(),
            marker_ids: vec!["beads_dir".into()],
            capability_ids: vec!["beads_task_backend".into()],
        });
    }

    if (has("claude_contract") || has("claude_contract_dir")) && !has("agents_contract") {
        warnings.push(ScanWarning {
            id: "claude_contract_without_agents_contract".into(),
            severity: WarningSeverity::Info,
            title: "CLAUDE.md without AGENTS.md".into(),
            detail: "Claude instructions exist but no AGENTS.md. Consider adding AGENTS.md for multi-provider support.".into(),
            marker_ids: vec!["claude_contract".into()],
            capability_ids: vec!["claude_instructions".into()],
        });
    }

    if has("rtk_rules") && !has("rtk_config") {
        warnings.push(ScanWarning {
            id: "rtk_rules_without_rtk_config".into(),
            severity: WarningSeverity::Info,
            title: "RTK rules without config".into(),
            detail: "RTK agent rules exist but .rtk/ config directory is missing.".into(),
            marker_ids: vec!["rtk_rules".into()],
            capability_ids: vec!["rtk_token_optimizer".into()],
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

    if has("simplecode_manifest") {
        let manifest_path = root.join(".simplecode/manifest.toml");
        if manifest_path.exists() && std::fs::read_to_string(&manifest_path).is_err() {
            blockers.push(ScanBlocker {
                id: "manifest_unreadable".into(),
                title: "Manifest unreadable".into(),
                detail: "Cannot read .simplecode/manifest.toml".into(),
                marker_ids: vec!["simplecode_manifest".into()],
                recommended_action: "Check file permissions on .simplecode/manifest.toml".into(),
            });
        }
    }

    // ── Classify initialization state ──
    let has_simplecode = has("simplecode_manifest");
    let has_ai = has("ai_contract");
    let has_agents = has("agents_contract");
    let has_task_or_spec = has("beads_dir") || kspec_has_worktree;
    let has_third_party = has("claude_contract") || has("claude_contract_dir") || has("codex_config")
        || kspec_has_worktree || has("beads_dir") || gsd_installed;

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
    if has("claude_contract") || has("claude_contract_dir") { preserve_candidates.push("CLAUDE.md".into()); }
    if has("beads_dir") { preserve_candidates.push(".beads/".into()); migration_sources.push(SourceSystem::Beads); }
    if kspec_has_worktree { preserve_candidates.push(".kspec/".into()); migration_sources.push(SourceSystem::Kspec); }
    if gsd_installed { preserve_candidates.push(".planning/".into()); migration_sources.push(SourceSystem::Gsd); }

    let upgrade_inputs = UpgradeProposalInput {
        can_propose_minimal,
        can_propose_standard,
        can_propose_full,
        recommended_preset,
        create_candidates,
        modify_candidates,
        preserve_candidates,
        migration_sources,
        rollback_notes: vec!["Created files can be safely deleted to rollback.".into()],
    };

    ProjectCapabilityScan {
        root_path: root_path.to_string(),
        scanned_at: Utc::now().to_rfc3339(),
        initialization_state,
        markers,
        capabilities,
        warnings,
        blockers,
        upgrade_inputs,
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn detect_marker(
    root: &Path,
    markers: &mut Vec<DetectedMarker>,
    id: &str,
    rel_path: &str,
    kind: MarkerKind,
    source_system: SourceSystem,
) {
    let full_path = root.join(rel_path);
    let (status, confidence) = if full_path.exists() {
        if full_path.is_dir() || std::fs::metadata(&full_path).is_ok() {
            (MarkerStatus::Present, Confidence::High)
        } else {
            (MarkerStatus::Unreadable, Confidence::Medium)
        }
    } else {
        (MarkerStatus::Missing, Confidence::High)
    };

    markers.push(DetectedMarker {
        id: id.to_string(),
        kind,
        path: Some(rel_path.to_string()),
        source_system,
        confidence,
        status,
    });
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

pub fn generate_proposal(
    scan: &ProjectCapabilityScan,
    preset: &ProposalPreset,
    project_name: &str,
    task_backend: &str,
    enabled_capability_ids: Option<Vec<String>>,
) -> InitializationProposal {
    let mut operations = Vec::new();
    let root = Path::new(&scan.root_path);

    let now = Utc::now().to_rfc3339();
    let proposal_id = uuid::Uuid::new_v4().to_string();

    let is_enabled = |cap_id: &str| {
        if let Some(ref ids) = enabled_capability_ids {
            ids.contains(&cap_id.to_string())
        } else {
            true // Default to true if not specified (legacy behavior)
        }
    };

    // Create .simplecode directory
    if !marker_present(&scan.markers, "simplecode_manifest") {
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
mcp = false
"#,
            proposal_id,
            scan.root_path,
            now,
            preset_to_str(preset),
            task_backend,
            if task_backend == "kspec" { "kspec" } else { "none" },
            task_backend == "beads",
            task_backend == "kspec",
        );

        if is_enabled("simplecode_project_contract") {
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
    }

    // ai.md for standard+ presets
    if !matches!(preset, ProposalPreset::Minimal | ProposalPreset::Guarded) && !marker_present(&scan.markers, "ai_contract") && is_enabled("simplecode_project_contract") {
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

    // AGENTS.md for standard+ presets
    if !matches!(preset, ProposalPreset::Minimal) && !marker_present(&scan.markers, "agents_contract") && is_enabled("agents_instructions") {
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

    // Git init for new projects
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
            requires_approval: false,
        });
    }

    // Task backend init for standard/full presets
    if matches!(preset, ProposalPreset::Standard | ProposalPreset::FullSpecDriven) {
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
    }

    // Preserve existing files
    for preserve in &scan.upgrade_inputs.preserve_candidates {
        operations.push(ProposalOperation {
            id: format!("preserve_{}", preserve.replace('/', "_").replace('.', "")),
            kind: OperationKind::Preserve,
            path: Some(preserve.clone()),
            command: None,
            source_system: SourceSystem::User,
            reason: format!("Existing {} preserved — not modified by initialization", preserve),
            preview: None,
            risk: OperationRisk::Low,
            requires_approval: false,
        });
    }

    let summary = format!(
        "{} initialization with {} preset: {} files to create, {} commands to run, {} items preserved",
        project_name,
        preset_to_str(preset),
        operations.iter().filter(|o| matches!(o.kind, OperationKind::CreateFile | OperationKind::CreateDirectory)).count(),
        operations.iter().filter(|o| matches!(o.kind, OperationKind::RunCommand)).count(),
        operations.iter().filter(|o| matches!(o.kind, OperationKind::Preserve)).count(),
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
pub fn apply_proposal(proposal: &InitializationProposal) -> Result<Vec<String>, String> {
    let root = Path::new(&proposal.root_path);
    let mut applied = Vec::new();

    // Ensure root exists
    if !root.exists() {
        std::fs::create_dir_all(root).map_err(|e| format!("Failed to create root: {}", e))?;
        applied.push(format!("Created root directory: {}", proposal.root_path));
    }

    for op in &proposal.operations {
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
                        applied.push(format!("Command '{}' failed: {}", cmd, stderr.trim()));
                    }
                }
            }
            OperationKind::ModifyFile => {
                if let Some(ref path) = op.path {
                    let full = root.join(path);
                    if full.exists() {
                        if let Some(ref content) = op.preview {
                            // Basic append for now, but in a real scenario this might be smarter
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
pub async fn project_apply_proposal(proposal: InitializationProposal) -> Result<Vec<String>, String> {
    apply_proposal(&proposal)
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
