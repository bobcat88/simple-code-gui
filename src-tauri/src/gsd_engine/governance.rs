use serde::{Deserialize, Serialize};
use std::path::Path;
use std::fs;
use regex::Regex;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PolicyMode {
    Permissive,
    Watchful,
    Strict,
    Locked,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PermissionType {
    Allow,
    RequireApproval,
    Deny,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolPermission {
    pub permission_type: PermissionType,
    pub patterns: Vec<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceRule {
    pub selector: ToolSelector,
    pub permissions: Vec<ToolPermission>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolSelector {
    pub tool: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyMetadata {
    pub name: String,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwarmPolicy {
    pub version: String,
    pub metadata: PolicyMetadata,
    pub rules: Vec<GovernanceRule>,
    pub default_mode: PolicyMode,
}

pub struct GovernanceEngine {
    pub policy: SwarmPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceVerdict {
    pub permission: PermissionType,
    pub message: Option<String>,
}

impl GovernanceEngine {
    pub fn new_default() -> Self {
        Self {
            policy: SwarmPolicy {
                version: "1.0".to_string(),
                metadata: PolicyMetadata {
                    name: "Default Safe Policy".to_string(),
                    id: "default-safe".to_string(),
                },
                rules: vec![
                    GovernanceRule {
                        selector: ToolSelector { tool: "run_command".to_string() },
                        permissions: vec![
                            ToolPermission {
                                permission_type: PermissionType::Allow,
                                patterns: vec![
                                    "git status".to_string(),
                                    "git log*".to_string(),
                                    "ls*".to_string(),
                                    "rtk *".to_string(),
                                    "bun test*".to_string(),
                                ],
                                message: None,
                            },
                            ToolPermission {
                                permission_type: PermissionType::RequireApproval,
                                patterns: vec![
                                    "rm *".to_string(),
                                    "*install*".to_string(),
                                    "git push*".to_string(),
                                ],
                                message: Some("This command has potential side effects.".to_string()),
                            },
                        ],
                    }
                ],
                default_mode: PolicyMode::Watchful,
            },
        }
    }

    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        let policy: SwarmPolicy = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;
        Ok(Self { policy })
    }

    pub fn evaluate(&self, tool_name: &str, arguments: &str) -> GovernanceVerdict {
        if self.policy.default_mode == PolicyMode::Locked {
            return GovernanceVerdict {
                permission: PermissionType::Deny,
                message: Some("Swarm tool execution is globally locked.".to_string()),
            };
        }

        // Find matching rules
        for rule in &self.policy.rules {
            if rule.selector.tool == tool_name || rule.selector.tool == "*" {
                for perm in &rule.permissions {
                    for pattern in &perm.patterns {
                        if self.match_pattern(pattern, arguments) {
                            return GovernanceVerdict {
                                permission: perm.permission_type,
                                message: perm.message.clone(),
                            };
                        }
                    }
                }
            }
        }

        // Default behavior based on mode
        match self.policy.default_mode {
            PolicyMode::Permissive => GovernanceVerdict {
                permission: PermissionType::Allow,
                message: None,
            },
            PolicyMode::Watchful => GovernanceVerdict {
                permission: PermissionType::Allow,
                message: Some("Tool execution permitted under watchful mode.".to_string()),
            },
            PolicyMode::Strict => GovernanceVerdict {
                permission: PermissionType::RequireApproval,
                message: Some("Strict mode: all unknown tool calls require approval.".to_string()),
            },
            PolicyMode::Locked => unreachable!(),
        }
    }

    fn match_pattern(&self, pattern: &str, input: &str) -> bool {
        // Convert glob-like pattern to regex
        let regex_pattern = pattern
            .replace("*", ".*")
            .replace("?", ".");
        
        if let Ok(re) = Regex::new(&format!("^{}$", regex_pattern)) {
            re.is_match(input)
        } else {
            // Fallback to simple contains if regex fails
            input.contains(pattern)
        }
    }
}
