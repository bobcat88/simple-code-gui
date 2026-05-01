use std::collections::HashMap;
use std::sync::Arc;
use serde_json::{json, Value};

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

pub struct GsdEngine {
    pub active_plans: Arc<Mutex<HashMap<String, GsdPlan>>>,
    pub pending_responses: Arc<Mutex<HashMap<String, tokio::sync::oneshot::Sender<UserResponse>>>>,
    pub pending_approvals: Arc<Mutex<HashMap<String, tokio::sync::oneshot::Sender<bool>>>>,
    pub db: Arc<DatabaseManager>,
    pub knowledge: Arc<Mutex<Option<knowledge::SwarmMemory>>>,
    pub governance: Arc<Mutex<governance::GovernanceEngine>>,
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
            pending_approvals: Arc::new(Mutex::new(HashMap::new())),
            db,
            knowledge: Arc::new(Mutex::new(None)),
            governance: Arc::new(Mutex::new(governance::GovernanceEngine::new_default())),
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
            *knowledge = Some(mem);
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
    ai_runtime: State<'_, Arc<RuntimeManager>>,
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
    
    // 2. Build the plan structure
    let mut metadata = HashMap::new();
    metadata.insert("goal".to_string(), "Execute proactive refactoring".to_string());
    metadata.insert("finding".to_string(), finding.to_string());
    metadata.insert("author".to_string(), "Swarm Architect".to_string());
    metadata.insert("complexity".to_string(), finding["risk"].as_str().unwrap_or("MEDIUM").to_string());

    let mut plan = GsdPlan {
        id: plan_id.clone(),
        title: title.to_string(),
        task_id: format!("refactor-{}", uuid::Uuid::new_v4()),
        phases: vec![GsdPhase {
            id: "refactor-phase-1".to_string(),
            title: "Implementation".to_string(),
            steps: vec![GsdStep {
                id: "refactor-step-1".to_string(),
                title: format!("Apply refactor: {}", title),
                description: description.to_string(),
                status: StepStatus::Pending,
                result: None,
                attempts: 0,
                max_retries: 3,
                wave_index: Some(0),
                started_at: None,
                completed_at: None,
            }],
            status: StepStatus::Pending,
            started_at: None,
            completed_at: None,
        }],
        metadata,
        dry_run: dry_run.unwrap_or(false),
    };

    // 3. Register and save the plan
    {
        let mut plans = state.active_plans.lock().await;
        plans.insert(plan_id.clone(), plan.clone());
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
    state: State<'_, Arc<GsdEngine>>,
    approval_id: String,
    response: String,
) -> Result<(), String> {
    let user_res = match response.to_lowercase().as_str() {
        "approve" => UserResponse::Approve,
        "reject" => UserResponse::Abort,
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
) -> Result<Vec<String>, String> {
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
    state: State<'_, Arc<GsdEngine>>,
    orch: State<'_, OrchestrationState>,
) -> Result<String, String> {
    let project_path = orch.current_project_path.lock().clone();
    tools::execute_tool("gsd_identify_refactors", "{}", &project_path, &app).await
}

#[tauri::command]
pub async fn gsd_swarm_record_pattern(
    state: State<'_, Arc<GsdEngine>>,
    pattern_type: String,
    pattern_key: String,
    content: String,
    metadata: String,
) -> Result<(), String> {
    let knowledge = state.knowledge.lock().await;
    if let Some(mem) = knowledge.as_ref() {
        mem.record(&pattern_type, &pattern_key, &content, &metadata)
            .map_err(|e| e.to_string())
    } else {
        Err("Swarm memory not initialized for current project".to_string())
    }
}

#[tauri::command]
pub async fn gsd_sync_memory(
    state: State<'_, Arc<Mutex<GsdEngine>>>,
) -> Result<usize, String> {
    let engine = state.lock().await;
    let knowledge_lock = engine.knowledge.lock().await;
    
    if let Some(ref knowledge) = *knowledge_lock {
        // First import from global
        let imported = sync::GlobalSync::import(knowledge)?;
        // Then export local to global
        sync::GlobalSync::export(knowledge)?;
        Ok(imported)
    } else {
        Err("Swarm memory not initialized".to_string())
    }
}

#[tauri::command]
pub async fn gsd_update_policy(
    state: State<'_, Arc<Mutex<GsdEngine>>>,
    orch_state: State<'_, crate::orchestration::OrchestrationState>,
    policy: governance::SwarmPolicy,
) -> Result<(), String> {
    let engine = state.lock().await;
    let mut gov = engine.governance.lock().await;
    gov.policy = policy;
    
    // Save to file if project path exists
    let project_path = orch_state.current_project_path.lock().clone();
    if let Some(path) = project_path {
        let policy_path = std::path::Path::new(&path).join(".planning/gsd/governance.yaml");
        gov.save_to_file(policy_path)?;
    }
    
    Ok(())
}
