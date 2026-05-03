use async_trait::async_trait;
use crate::ai_runtime::types::{AgentRole, CompletionRequest, TaskType};
use super::super::context::OptimizationContext;
use super::super::middleware::OptimizationMiddleware;

pub struct BudgetMiddleware;

#[async_trait]
impl OptimizationMiddleware for BudgetMiddleware {
    fn name(&self) -> &str {
        "budget"
    }

    async fn apply(
        &self, 
        request: &mut CompletionRequest, 
        context: &OptimizationContext,
        _embedding_service: Option<&dyn crate::ai_runtime::optimizer::context::EmbeddingService>
    ) -> Result<(), String> {
        if request.max_tokens.is_some() {
            return Ok(());
        }

        let budget = match (&context.task, &context.role) {
            (_, Some(AgentRole::Planner)) => Some(8_000),
            (Some(TaskType::Reasoning), _) => Some(4_000),
            (Some(TaskType::Coding), _) => Some(4_000),
            (Some(TaskType::Creative), _) => Some(2_000),
            (Some(TaskType::Vision), _) => Some(2_000),
            (Some(TaskType::Fast), _) => Some(512),
            _ => None,
        };

        if let Some(budget) = budget {
            request.max_tokens = Some(budget);
        }
        Ok(())
    }
}
