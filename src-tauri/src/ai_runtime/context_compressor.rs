#![allow(dead_code)]

use std::process::Command;

use super::types::CompletionRequest;

#[derive(Debug, Clone)]
pub struct ContextCompressor {
    command: Option<String>,
    min_chars: usize,
}

impl ContextCompressor {
    pub fn disabled() -> Self {
        Self {
            command: None,
            min_chars: usize::MAX,
        }
    }

    pub fn from_command(command: Option<String>) -> Self {
        Self {
            command,
            min_chars: 8_000,
        }
    }

    pub fn is_available(&self) -> bool {
        let Some(command) = self.command.as_ref() else {
            return false;
        };
        Command::new(command)
            .arg("--version")
            .output()
            .is_ok_and(|output| output.status.success())
    }

    pub fn compress(&self, request: &mut CompletionRequest) -> usize {
        if self.command.is_none() || contains_tool_boundary(request) {
            return 0;
        }
        let before = request
            .messages
            .iter()
            .map(|message| message.content.len())
            .sum::<usize>();
        if before < self.min_chars {
            return 0;
        }
        0
    }
}

fn contains_tool_boundary(request: &CompletionRequest) -> bool {
    request
        .messages
        .iter()
        .any(|message| message.tool_calls.is_some() || message.tool_call_id.is_some())
        || request.tools.is_some()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_runtime::types::{Message, ToolCall};

    #[test]
    fn disabled_compressor_is_noop() {
        let mut request = CompletionRequest::default();

        assert_eq!(ContextCompressor::disabled().compress(&mut request), 0);
    }

    #[test]
    fn compressor_preserves_tool_boundaries() {
        let mut request = CompletionRequest {
            messages: vec![Message {
                role: "assistant".to_string(),
                content: "x".repeat(10_000),
                tool_calls: Some(vec![ToolCall {
                    id: "call".to_string(),
                    name: "tool".to_string(),
                        cache_control: None,
                    arguments: "{}".to_string(),
                }]),
                tool_call_id: None,
            }],
            ..Default::default()
        };

        assert_eq!(
            ContextCompressor::from_command(Some("llmlingua".to_string())).compress(&mut request),
            0
        );
    }
}
