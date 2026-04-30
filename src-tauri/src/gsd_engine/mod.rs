use std::collections::HashMap;
use std::sync::Arc;

use crate::ai_runtime::RuntimeManager;
use crate::database::DatabaseManager;
use crate::gsd_engine::types::{GsdPhase, GsdPlan, GsdStep, StepStatus};
use crate::orchestration::OrchestrationState;
use tauri::{AppHandle, Emitter, State};
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
pub async fn gsd_execute_plan(
    app: AppHandle,
    state: State<'_, Arc<GsdEngine>>,
    orch: State<'_, OrchestrationState>,
    ai_runtime: State<'_, Arc<RuntimeManager>>,
    plan_id: String,
) -> Result<(), String> {
    let mut plan = {
        let plans = state.active_plans.lock().await;
        plans
            .get(&plan_id)
            .cloned()
            .ok_or_else(|| "Plan not found".to_string())?
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
            engine.governance.clone()
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
    term: String,
) -> Result<Vec<String>, String> {
    let knowledge = state.knowledge.lock().await;
    if let Some(mem) = knowledge.as_ref() {
        mem.query(&term).map_err(|e| e.to_string())
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub async fn gsd_swarm_record_pattern(
    state: State<'_, Arc<GsdEngine>>,
    entry_type: String,
    context: String,
    content: String,
    meta: String,
) -> Result<(), String> {
    let knowledge = state.knowledge.lock().await;
    if let Some(mem) = knowledge.as_ref() {
        mem.record(&entry_type, &context, &content, &meta)
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
