use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use serde_json::Value;

use crate::ai_runtime::RuntimeManager;
use crate::database::DatabaseManager;
use crate::gsd_engine::types::{GsdPhase, GsdPlan, GsdStep, StepStatus};
use crate::orchestration::OrchestrationState;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::Mutex;

pub mod executor;
pub mod types;
pub mod tools;
pub mod knowledge;
pub mod forensics;
pub mod governance;
pub mod sync;
pub mod quantum_sync;
pub mod borg;
pub mod distributed;


pub struct GsdEngine {
    pub active_plans: Arc<Mutex<HashMap<String, GsdPlan>>>,
    pub pending_responses: Arc<Mutex<HashMap<String, tokio::sync::oneshot::Sender<UserResponse>>>>,
    pub db: Arc<DatabaseManager>,
    pub knowledge: Arc<Mutex<Option<Arc<knowledge::SwarmMemory>>>>,
    pub governance: Arc<Mutex<governance::GovernanceEngine>>,
    pub is_syncing: std::sync::Arc<std::sync::atomic::AtomicBool>,
    pub quantum_sync: Arc<Mutex<Option<quantum_sync::QuantumSyncManager>>>,
    pub distributed: Arc<Mutex<Option<distributed::DistributedManager>>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum UserResponse {
    Approve,
    ApproveFix,
    ResolveR1,
    ResolveR2,
    ApproveDelegation,
    RejectDelegation,
    Retry,
    Abort,
}

impl GsdEngine {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self {
            active_plans: Arc::new(Mutex::new(HashMap::new())),
            pending_responses: Arc::new(Mutex::new(HashMap::new())),
            db,
            knowledge: Arc::new(Mutex::new(None)),
            governance: Arc::new(Mutex::new(governance::GovernanceEngine::new_default())),
            is_syncing: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
            quantum_sync: Arc::new(Mutex::new(None)),
            distributed: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn save_plan(&self, project_path: &str, plan: &GsdPlan) -> Result<(), String> {
        let plans_dir = std::path::Path::new(project_path)
            .join(".planning")
            .join("gsd")
            .join("plans");

        if !plans_dir.exists() {
            std::fs::create_dir_all(&plans_dir).map_err(|e| e.to_string())?;
        }

        let plan_path = plans_dir.join(format!("{}.json", plan.id));
        let content = serde_json::to_string_pretty(plan).map_err(|e| e.to_string())?;
        std::fs::write(&plan_path, content).map_err(|e| e.to_string())?;

        // Automatic git add (optional but recommended for 'git-backed')
        let _ = std::process::Command::new("git")
            .arg("add")
            .arg(&plan_path)
            .current_dir(project_path)
            .output();

        Ok(())
    }

    pub async fn ensure_knowledge_base(&self, project_path: &str) -> Result<(), String> {
        let mut knowledge = self.knowledge.lock().await;
        if knowledge.is_none() {
            let db_path = std::path::Path::new(project_path)
                .join(".planning")
                .join("gsd")
                .join("knowledge.db");
            
            if let Some(parent) = db_path.parent() {
                if !parent.exists() {
                    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
            }

            let mem = knowledge::SwarmMemory::new(db_path).map_err(|e| e.to_string())?;
            *knowledge = Some(Arc::new(mem));
        }
        Ok(())
    }

    pub async fn ensure_governance(&self, project_path: &str) -> Result<(), String> {
        let policy_path = std::path::Path::new(project_path)
            .join(".planning")
            .join("gsd")
            .join("governance.yaml");
        
        if policy_path.exists() {
            let mut gov = self.governance.lock().await;
            match governance::GovernanceEngine::load_from_file(&policy_path) {
                Ok(engine) => *gov = engine,
                Err(e) => {
                    eprintln!("Failed to load governance policy from {}: {}", policy_path.display(), e);
                }
            }
        } else {
            // Create default policy file if it doesn't exist (Decisions in Git)
            if let Some(parent) = policy_path.parent() {
                if !parent.exists() {
                    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
            }
            let gov = self.governance.lock().await;
            let _ = gov.save_to_file(&policy_path);
            
            // Automatic git add
            let _ = std::process::Command::new("git")
                .arg("add")
                .arg(&policy_path)
                .current_dir(project_path)
                .output();
        }
        Ok(())
    }

    pub async fn load_plans(&self, project_path: &str) -> Result<Vec<GsdPlan>, String> {
        self.ensure_knowledge_base(project_path).await?;
        self.ensure_governance(project_path).await?;
        let plans_dir = std::path::Path::new(project_path)
            .join(".planning")
            .join("gsd")
            .join("plans");

        if !plans_dir.exists() {
            return Ok(Vec::new());
        }

        let mut loaded = Vec::new();
        let entries = std::fs::read_dir(plans_dir).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            if entry.path().extension().and_then(|s| s.to_str()) == Some("json") {
                let content = std::fs::read_to_string(entry.path()).map_err(|e| e.to_string())?;
                let plan: GsdPlan = serde_json::from_str(&content).map_err(|e| e.to_string())?;
                loaded.push(plan);
            }
        }

        let mut plans = self.active_plans.lock().await;
        for plan in &loaded {
            plans.insert(plan.id.clone(), plan.clone());
        }

        Ok(loaded)
    }
}

#[tauri::command]
pub async fn gsd_create_plan(
    state: State<'_, Arc<GsdEngine>>,
    orch: State<'_, OrchestrationState>,
    task_id: String,
    title: String,
) -> Result<GsdPlan, String> {
    let mut plans = state.active_plans.lock().await;
    let plan_id = uuid::Uuid::new_v4().to_string();

    let plan = GsdPlan {
        id: plan_id.clone(),
        title,
        task_id,
        phases: Vec::new(),
        metadata: HashMap::from([
            ("execution_mode".to_string(), "full".to_string()),
            ("wave_size".to_string(), "2".to_string()),
            ("verifier_retries".to_string(), "3".to_string()),
        ]),
        dry_run: false,
    };

    plans.insert(plan_id.clone(), plan.clone());

    let project_path = orch.current_project_path.lock().clone();
    if let Some(path) = project_path {
        state.save_plan(&path, &plan).await?;
    }

    Ok(plan)
}

#[tauri::command]
pub async fn gsd_add_phase(
    state: State<'_, Arc<GsdEngine>>,
    orch: State<'_, OrchestrationState>,
    plan_id: String,
    title: String,
) -> Result<GsdPhase, String> {
    let mut plans = state.active_plans.lock().await;
    let plan = plans
        .get_mut(&plan_id)
        .ok_or_else(|| "Plan not found".to_string())?;

    let phase_id = uuid::Uuid::new_v4().to_string();
    let phase = GsdPhase {
        id: phase_id,
        title,
        steps: Vec::new(),
        status: StepStatus::Pending,
        started_at: None,
        completed_at: None,
    };

    plan.phases.push(phase.clone());

    let project_path = orch.current_project_path.lock().clone();
    if let Some(path) = project_path {
        state.save_plan(&path, plan).await?;
    }

    Ok(phase)
}

#[tauri::command]
pub async fn gsd_add_step(
    state: State<'_, Arc<GsdEngine>>,
    orch: State<'_, OrchestrationState>,
    plan_id: String,
    phase_id: String,
    title: String,
    description: String,
) -> Result<GsdStep, String> {
    let mut plans = state.active_plans.lock().await;
    let plan = plans
        .get_mut(&plan_id)
        .ok_or_else(|| "Plan not found".to_string())?;
    let phase = plan
        .phases
        .iter_mut()
        .find(|p| p.id == phase_id)
        .ok_or_else(|| "Phase not found".to_string())?;

    let step_id = uuid::Uuid::new_v4().to_string();
    let step = GsdStep {
        id: step_id,
        title,
        description,
        status: StepStatus::Pending,
        result: None,
        attempts: 0,
        max_retries: 3,
        wave_index: None,
        started_at: None,
        completed_at: None,
    };

    phase.steps.push(step.clone());

    let project_path = orch.current_project_path.lock().clone();
    if let Some(path) = project_path {
        state.save_plan(&path, plan).await?;
    }

    Ok(step)
}

#[tauri::command]
pub async fn gsd_apply_refactor(
    app: AppHandle,
    state: State<'_, Arc<GsdEngine>>,
    orch: State<'_, OrchestrationState>,
    _ai_runtime: State<'_, Arc<RuntimeManager>>,
    finding: Value,
    dry_run: Option<bool>,
) -> Result<String, String> {
    let project_path = orch.current_project_path.lock().clone();
    let title = finding["title"].as_str().or(finding["symbolName"].as_str()).unwrap_or("Proactive Refactor");
    let finding_json = finding.to_string();
    let description = format!("{}\n\nFinding Context:\n{}", 
        finding["description"].as_str().or(finding["reason"].as_str()).unwrap_or("Refactoring recommended by Swarm Architect."),
        finding_json
    );
    
    // 1. Create a unique plan ID
    let plan_id = format!("refactor-{}", uuid::Uuid::new_v4());
    
    // 2. Build the plan structure with Impact-Aware Patching
    let mut metadata = HashMap::new();
    metadata.insert("goal".to_string(), "Execute proactive refactoring".to_string());
    metadata.insert("finding".to_string(), finding.to_string());
    metadata.insert("author".to_string(), "Swarm Architect".to_string());
    metadata.insert("complexity".to_string(), finding["risk"].as_str().unwrap_or("MEDIUM").to_string());

    let symbol_name = finding["symbolName"].as_str();
    let mut phases = Vec::new();

    // PHASE 1: Impact Analysis (Conditional)
    if let Some(symbol) = symbol_name {
        phases.push(GsdPhase {
            id: "refactor-impact-analysis".to_string(),
            title: "Impact Analysis".to_string(),
            steps: vec![GsdStep {
                id: "refactor-impact-step-1".to_string(),
                title: format!("Blast Radius Analysis: {}", symbol),
                description: format!("Use the `gitnexus_impact` tool to analyze the blast radius of changing `{}`. Report any HIGH or CRITICAL risks found. If the risk is unacceptable, abort the refactoring.", symbol),
                status: StepStatus::Pending,
                result: None,
                attempts: 0,
                max_retries: 2,
                wave_index: Some(1),
                started_at: None,
                completed_at: None,
            }],
            status: StepStatus::Pending,
            started_at: None,
            completed_at: None,
        });
    }

    // PHASE 2: Implementation
    let mut impl_steps = Vec::new();
    if let Some(files) = finding["affectedFiles"].as_array() {
        for (i, file) in files.iter().enumerate() {
            let file_path = file.as_str().unwrap_or("unknown_file");
            impl_steps.push(GsdStep {
                id: format!("refactor-step-{}", i + 1),
                title: format!("Apply refactor to: {}", file_path),
                description: format!("Apply the refactoring logic to `{}`. {}", file_path, description),
                status: StepStatus::Pending,
                result: None,
                attempts: 0,
                max_retries: 3,
                wave_index: Some(1), // Execute all in parallel
                started_at: None,
                completed_at: None,
            });
        }
    } else {
        // Fallback to single step
        impl_steps.push(GsdStep {
            id: "refactor-step-1".to_string(),
            title: format!("Apply refactor: {}", title),
            description: description.to_string(),
            status: StepStatus::Pending,
            result: None,
            attempts: 0,
            max_retries: 3,
            wave_index: Some(1),
            started_at: None,
            completed_at: None,
        });
    }

    phases.push(GsdPhase {
        id: "refactor-implementation".to_string(),
        title: "Implementation".to_string(),
        steps: impl_steps,
        status: StepStatus::Pending,
        started_at: None,
        completed_at: None,
    });

    // PHASE 3: Verification
    phases.push(GsdPhase {
        id: "refactor-verification".to_string(),
        title: "Verification".to_string(),
        steps: vec![GsdStep {
            id: "refactor-verify-step-1".to_string(),
            title: "Post-Refactor Verification".to_string(),
            description: "Run the project's build and test suite to ensure the refactoring didn't introduce regressions. Use `gitnexus_detect_changes` to verify the scope of changes matches expectations.".to_string(),
            status: StepStatus::Pending,
            result: None,
            attempts: 0,
            max_retries: 2,
            wave_index: Some(1),
            started_at: None,
            completed_at: None,
        }],
        status: StepStatus::Pending,
        started_at: None,
        completed_at: None,
    });

    let plan = GsdPlan {
        id: plan_id.clone(),
        title: title.to_string(),
        task_id: format!("refactor-{}", uuid::Uuid::new_v4()),
        phases,
        metadata,
        dry_run: dry_run.unwrap_or(false),
    };

    // 3. Register and save the plan
    {
        let mut plans = state.active_plans.lock().await;
        plans.insert(plan_id.clone(), plan.clone());
        // AC: @01KPNWTN ac-gen-1
        if let Some(ref path) = project_path {
            state.save_plan(path, &plan).await?;
        }
    }

    // 4. Trigger execution
    let plan_id_clone = plan_id.clone();
    let app_clone = app.clone();
    let dry_run_clone = plan.dry_run;

    tauri::async_runtime::spawn(async move {
        let state = app_clone.state::<Arc<GsdEngine>>();
        let orch = app_clone.state::<OrchestrationState>();
        let ai = app_clone.state::<Arc<RuntimeManager>>();
        let _ = gsd_execute_plan(app_clone.clone(), state, orch, ai, plan_id_clone, Some(dry_run_clone)).await;
    });

    Ok(plan_id)
}

#[tauri::command]
pub async fn gsd_get_refactor_details(
    _state: State<'_, Arc<GsdEngine>>,
    orch: State<'_, OrchestrationState>,
    symbol_name: String,
) -> Result<String, String> {
    let project_path = orch.current_project_path.lock().clone();
    
    // Use gitnexus_context tool logic
    let mut cmd = std::process::Command::new("gitnexus");
    cmd.arg("context").arg("--name").arg(&symbol_name);
    if let Some(ref path) = project_path {
        cmd.arg("--repo").arg(path);
    }
    
    let output = cmd.output().map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
// AC: @gsd-engine ac-gsd-1
pub async fn gsd_execute_plan(
    app: AppHandle,
    state: State<'_, Arc<GsdEngine>>,
    orch: State<'_, OrchestrationState>,
    ai_runtime: State<'_, Arc<RuntimeManager>>,
    plan_id: String,
    dry_run: Option<bool>,
) -> Result<(), String> {
    let mut plan = {
        let mut plans = state.active_plans.lock().await;
        let p = plans
            .get_mut(&plan_id)
            .ok_or_else(|| "Plan not found".to_string())?;
        
        if let Some(dr) = dry_run {
            p.dry_run = dr;
        }
        p.clone()
    };

    let engine = state.inner().clone();
    let ai = ai_runtime.inner().clone();
    let app_handle = app.clone();
    let project_path = orch.current_project_path.lock().clone();
    let active_project_paths = orch.active_project_paths.lock().clone();

    tauri::async_runtime::spawn(async move {
        if let Some(ref path) = project_path {
            let _ = engine.ensure_governance(path).await;
        }
        
        let executor = executor::Executor::new(
            ai, 
            engine.db.clone(), 
            app_handle.clone(), 
            engine.pending_responses.clone(),
            project_path.clone(),
            active_project_paths,
            engine.knowledge.clone(),
            engine.governance.clone(),
            plan.dry_run
        );
        let max_phase_step_count = plan
            .phases
            .iter()
            .map(|phase| phase.steps.len())
            .max()
            .unwrap_or(0);
        let runtime = executor::resolve_runtime_config(&plan.metadata, max_phase_step_count);
        let _ = app_handle.emit("gsd-execution-started", &plan_id);

        // Initial save for execution status
        if let Some(ref path) = project_path {
            let _ = engine.save_plan(path, &plan).await;
        }

        for phase_index in 0..plan.phases.len() {
            let phase_result = {
                let phase = &mut plan.phases[phase_index];
                // AC: @01KPNWTG ac-gen-1
                executor.execute_phase(&plan_id, phase, runtime).await
            };

            if let Err(e) = phase_result {
                let phase = &mut plan.phases[phase_index];
                phase.status = StepStatus::Failed(format!("Phase {} failed: {}", phase.id, e));
                let _ = app_handle.emit("gsd-phase-updated", phase.clone());

                let mut plans = engine.active_plans.lock().await;
                plans.insert(plan_id.clone(), plan.clone());
                
                if let Some(ref path) = project_path {
                    let _ = engine.save_plan(path, &plan).await;
                }
                
                let _ = app_handle.emit("gsd-execution-failed", &plan_id);
                return;
            }

            let mut plans = engine.active_plans.lock().await;
            plans.insert(plan_id.clone(), plan.clone());

            if let Some(ref path) = project_path {
                let _ = engine.save_plan(path, &plan).await;
            }
        }

        let _ = app_handle.emit("gsd-execution-completed", &plan_id);

        // Automatic Snapshot on completion
        if let Some(ref path) = project_path {
            let db = engine.db.clone();
            let name = format!("Execution Completed: {}", plan_id);
            let notes = format!("Automatic snapshot triggered by successful completion of GSD plan {}.", plan_id);
            let _ = crate::orchestration::internal_create_snapshot(&db, path, &name, Some(notes)).await;
        }

        // Final save
        let mut plans = engine.active_plans.lock().await;
        plans.insert(plan_id, plan.clone());
        if let Some(ref path) = project_path {
            let _ = engine.save_plan(path, &plan).await;
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn gsd_list_plans(
    state: State<'_, Arc<GsdEngine>>,
    orch: State<'_, OrchestrationState>,
) -> Result<Vec<GsdPlan>, String> {
    let project_path = orch.current_project_path.lock().clone();
    if let Some(path) = project_path {
        state.load_plans(&path).await
    } else {
        let plans = state.active_plans.lock().await;
        Ok(plans.values().cloned().collect())
    }
}

#[tauri::command]
pub async fn gsd_respond_to_checkpoint(
    state: State<'_, Arc<GsdEngine>>,
    step_id: String,
    response: UserResponse,
) -> Result<(), String> {
    let mut pending = state.pending_responses.lock().await;
    if let Some(sender) = pending.remove(&step_id) {
        let _ = sender.send(response);
        Ok(())
    } else {
        Err("No pending checkpoint for this step".to_string())
    }
}

#[tauri::command]
pub async fn gsd_respond_to_approval(
    app: AppHandle,
    state: State<'_, Arc<GsdEngine>>,
    approval_id: String,
    response: String,
) -> Result<(), String> {
    let user_res = match response.to_lowercase().as_str() {
        "approve" => UserResponse::Approve,
        "reject" => {
            // Cognitive Feedback Loop: Capture rejection for learning
            if let Some(learning) = app.try_state::<Arc<crate::ai_runtime::learning::LearningManager>>() {
                let _ = learning.record_feedback(
                    &app,
                    approval_id.clone(),
                    "approval_request".to_string(),
                    "User rejected the proposed action".to_string(),
                    false
                ).await;
            }
            UserResponse::Abort
        },
        _ => return Err(format!("Invalid response: {}", response)),
    };

    let mut pending = state.pending_responses.lock().await;
    if let Some(sender) = pending.remove(&approval_id) {
        let _ = sender.send(user_res);
        Ok(())
    } else {
        Err("No pending approval for this ID".to_string())
    }
}

#[tauri::command]
pub async fn gsd_get_personas(
    state: State<'_, Arc<GsdEngine>>,
) -> Result<Vec<governance::SwarmPersona>, String> {
    let gov = state.governance.lock().await;
    Ok(gov.policy.personas.clone())
}

#[tauri::command]
pub async fn gsd_list_tools() -> Result<Vec<crate::gsd_engine::types::ToolInfo>, String> {
    let tools = tools::get_gsd_tools();
    let tool_infos = tools.into_iter().map(|t| {
        crate::gsd_engine::types::ToolInfo {
            name: t.name,
            description: t.description,
            category: "General".to_string(),
            usage_count: 0,
            success_rate: 1.0,
            parameters_schema: t.parameters.to_string(),
        }
    }).collect();
    Ok(tool_infos)
}

#[tauri::command]
pub async fn gsd_get_governance_status(
    state: tauri::State<'_, Arc<GsdEngine>>,
) -> Result<crate::gsd_engine::governance::SwarmPolicy, String> {
    let gov = state.governance.lock().await;
    Ok(gov.policy.clone())
}

#[tauri::command]
pub async fn gsd_swarm_query_memory(
    state: State<'_, Arc<GsdEngine>>,
    orch: State<'_, OrchestrationState>,
    query: String,
    pattern_type: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<crate::gsd_engine::sync::MemoryEntry>, String> {
    let active_paths = orch.active_project_paths.lock().clone();
    let mut all_results = Vec::new();
    let mut seen = std::collections::HashSet::new();

    let pattern_type_ref = pattern_type.as_deref();

    for path in active_paths {
        let db_path = std::path::Path::new(&path)
            .join(".planning")
            .join("gsd")
            .join("knowledge.db");

        if db_path.exists() {
            if let Ok(mem) = knowledge::SwarmMemory::new(db_path) {
                if let Ok(results) = mem.query(&query, pattern_type_ref, limit) {
                    for res in results {
                        if seen.insert(res.clone()) {
                            all_results.push(res);
                        }
                    }
                }
            }
        }
    }

    // Also include the current locked knowledge if not already covered
    let knowledge = state.knowledge.lock().await;
    if let Some(mem) = knowledge.as_ref() {
        if let Ok(results) = mem.query(&query, pattern_type_ref, limit) {
            for res in results {
                if seen.insert(res.clone()) {
                    all_results.push(res);
                }
            }
        }
    }

    // Final limit check on aggregated results
    if let Some(l) = limit {
        if all_results.len() > l {
            all_results.truncate(l);
        }
    }

    Ok(all_results)
}

#[tauri::command]
pub async fn gsd_identify_refactors(
    app: AppHandle,
    _state: State<'_, Arc<GsdEngine>>,
    orch: State<'_, OrchestrationState>,
) -> Result<String, String> {
    let project_path = orch.current_project_path.lock().clone();
    tools::execute_tool("gsd_identify_refactors", "{}", &project_path, &app).await
}

#[tauri::command]
pub async fn gsd_swarm_record_pattern(
    state: State<'_, Arc<GsdEngine>>,
    mcp: State<'_, Arc<crate::mcp_bridge::McpManager>>,
    pattern_type: String,
    pattern_key: String,
    content: String,
    metadata: String,
) -> Result<(), String> {
    let knowledge = state.knowledge.lock().await;
    if let Some(mem) = knowledge.as_ref() {
        mem.record(&pattern_type, &pattern_key, &content, &metadata)
            .map_err(|e| e.to_string())?;

        // Phase 42: Broadcast to remote swarm nodes
        let entry = crate::gsd_engine::sync::MemoryEntry {
            entry_type: pattern_type,
            context: pattern_key,
            content,
            meta: metadata,
        };
        mcp.broadcast("memory-update", serde_json::to_value(&entry).unwrap()).await;

        Ok(())
    } else {
        Err("Swarm memory not initialized for current project".to_string())
    }
}

#[tauri::command]
pub async fn gsd_sync_memory(
    state: State<'_, Arc<GsdEngine>>,
) -> Result<usize, String> {
    let knowledge_lock = state.knowledge.lock().await;
    
    if let Some(ref knowledge) = *knowledge_lock {
        let bridge = borg::BorgBridge::new();
        let imported = bridge.sync_collective_memory(knowledge)?;
        Ok(imported)
    } else {
        Err("Swarm memory not initialized".to_string())
    }
}

#[tauri::command]
pub async fn gsd_update_policy(
    state: State<'_, Arc<GsdEngine>>,
    orch_state: State<'_, crate::orchestration::OrchestrationState>,
    policy: governance::SwarmPolicy,
) -> Result<(), String> {
    let mut gov = state.governance.lock().await;
    gov.policy = policy;
    
    // Save to file if project path exists
    let project_path = orch_state.current_project_path.lock().clone();
    if let Some(path) = project_path {
        let policy_path = std::path::Path::new(&path).join(".planning/gsd/governance.yaml");
        let yaml = serde_yaml::to_string(&gov.policy).map_err(|e| e.to_string())?;
        std::fs::write(policy_path, yaml).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn gsd_start_automatic_sync(
    state: State<'_, Arc<GsdEngine>>,
    app: AppHandle,
) -> Result<(), String> {
    if state.is_syncing.load(std::sync::atomic::Ordering::SeqCst) {
        return Ok(());
    }

    state.is_syncing.store(true, std::sync::atomic::Ordering::SeqCst);
    let state_clone = Arc::clone(&state);
    let is_syncing = Arc::clone(&state.is_syncing);

    tauri::async_runtime::spawn(async move {
        println!("[GSD] Starting automatic memory sync loop");
        while is_syncing.load(std::sync::atomic::Ordering::SeqCst) {
            // Perform sync
            {
                let knowledge_lock = state_clone.knowledge.lock().await;
                if let Some(ref knowledge) = *knowledge_lock {
                    let bridge = borg::BorgBridge::new();
                    let _ = bridge.sync_collective_memory(knowledge);
                    let _ = app.emit("gsd-sync-complete", ());
                }
            }
            // Sleep for 1 minute
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
        }
        println!("[GSD] Automatic memory sync loop stopped");
    });

    Ok(())
}

#[tauri::command]
pub async fn gsd_stop_automatic_sync(
    state: State<'_, Arc<GsdEngine>>,
) -> Result<(), String> {
    state.is_syncing.store(false, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn gsd_get_sync_status(
    state: State<'_, Arc<GsdEngine>>,
) -> bool {
    state.is_syncing.load(std::sync::atomic::Ordering::SeqCst)
}

#[tauri::command]
pub async fn gsd_quantum_sync_start(
    app: AppHandle,
    state: State<'_, Arc<GsdEngine>>,
    orch: State<'_, Arc<OrchestrationState>>,
) -> Result<(), String> {

    let project_path = orch.current_project_path.lock().clone();
    if let Some(path) = project_path {
        state.ensure_knowledge_base(&path).await?;
        
        let mut qsync = state.quantum_sync.lock().await;
        if qsync.is_none() {
            let knowledge = state.knowledge.lock().await;
            if let Some(mem) = knowledge.as_ref() {
                let manager = quantum_sync::QuantumSyncManager::new(Arc::clone(mem), app.clone());
                manager.start_synaptic_watch().await?;
                *qsync = Some(manager);
            }
        }
    }
    Ok(())
}



#[tauri::command]
pub async fn gsd_execute_proactive_audit(
    app: AppHandle,
    _state: State<'_, Arc<GsdEngine>>,
    orch: State<'_, OrchestrationState>,
    project_path: Option<String>,
) -> Result<String, String> {
    let path = project_path.or_else(|| orch.current_project_path.lock().clone());
    tools::execute_tool("gsd_proactive_audit", "{}", &path, &app).await
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SynapticMetrics {
    pub feedback_loops: usize,
    pub active_optimizations: usize,
    pub cognitive_load: f64,
    pub swarm_cohesion: f64,
}

#[tauri::command]
pub async fn gsd_get_synaptic_metrics(
    state: State<'_, Arc<GsdEngine>>,
) -> Result<SynapticMetrics, String> {
    let gov = state.governance.lock().await;
    
    // Heuristic metrics
    Ok(SynapticMetrics {
        feedback_loops: 3, // Synchronizer, Evolution, PeerReview
        active_optimizations: 0,
        cognitive_load: 0.42, // Dummy for now
        swarm_cohesion: 0.85, // Heuristic: high cohesion by default
    })
}


#[tauri::command]
pub async fn gsd_trigger_expansion_loop(
    _loop_type: String,
) -> Result<(), String> {
    // Stub for future loop orchestration
    Ok(())
}

#[tauri::command]
pub async fn gsd_start_distributed_discovery(
    state: State<'_, Arc<GsdEngine>>,
) -> Result<(), String> {
    let mut dist = state.distributed.lock().await;
    if dist.is_none() {
        // TODO: Get real redis URL and node name from settings
        let redis_url = "redis://127.0.0.1/".to_string();
        let node_name = "Nexus-Node".to_string();
        *dist = Some(distributed::DistributedManager::new(node_name, redis_url));
    }
    
    if let Some(mgr) = dist.as_ref() {
        mgr.start_discovery().await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn gsd_stop_distributed_discovery(
    state: State<'_, Arc<GsdEngine>>,
) -> Result<(), String> {
    let dist = state.distributed.lock().await;
    if let Some(mgr) = dist.as_ref() {
        mgr.stop_discovery().await;
    }
    Ok(())
}

#[tauri::command]
pub async fn gsd_get_distributed_nodes(
    state: State<'_, Arc<GsdEngine>>,
) -> Result<Vec<distributed::DistributedNode>, String> {
    let dist = state.distributed.lock().await;
    if let Some(mgr) = dist.as_ref() {
        Ok(mgr.get_nodes().await)
    } else {
        Ok(Vec::new())
    }
}
