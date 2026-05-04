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
        Command::new("uv")
            .arg("--version")
            .output()
            .is_ok_and(|output| output.status.success())
    }

    pub fn compress(&self, request: &mut CompletionRequest) -> usize {
        if contains_tool_boundary(request) {
            return 0;
        }

        let mut total_saved = 0;
        
        for message in request.messages.iter_mut() {
            if message.content.len() < self.min_chars {
                continue;
            }

            // Call LLMLingua v2 bridge
            let input = serde_json::json!({
                "text": message.content,
                "rate": 0.6
            });

            let child = Command::new("uv")
                .args(["run", "--with", "llmlingua", "--with", "torch", "--with", "transformers", "scripts/llmlingua_v2.py"])
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
                .map_err(|e| e.to_string());

            if let Ok(mut child) = child {
                use std::io::Write;
                if let Some(mut stdin) = child.stdin.take() {
                    let _ = stdin.write_all(input.to_string().as_bytes());
                }

                if let Ok(output) = child.wait_with_output() {
                    if output.status.success() {
                        let res: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap_or_default();
                        if let Some(compressed) = res["compressed"].as_str() {
                            let saved = message.content.len().saturating_sub(compressed.len());
                            message.content = compressed.to_string();
                            total_saved += saved;
                        }
                    } else {
                        let err = String::from_utf8_lossy(&output.stderr);
                        eprintln!("LLMLingua compression failed: {}", err);
                    }
                }
            }
        }
        
        total_saved
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
