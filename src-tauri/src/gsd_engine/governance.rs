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
#[serde(rename_all = "camelCase")]
pub struct SwarmPersona {
    pub id: String,
    pub name: String,
    pub role: String,
    pub expertise: Vec<String>,
    pub tools: Vec<String>,
    pub governance_tier: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwarmPolicy {
    pub version: String,
    pub metadata: PolicyMetadata,
    pub default_mode: PolicyMode,
    pub rules: Vec<GovernanceRule>,
    pub personas: Vec<SwarmPersona>,
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
                default_mode: PolicyMode::Watchful,
                rules: vec![
                    GovernanceRule {
                        selector: ToolSelector { tool: "git".to_string() },
                        permissions: vec![
                            ToolPermission {
                                permission_type: PermissionType::RequireApproval,
                                patterns: vec![".*push.*".to_string()],
                                message: Some("Direct push to remote requires manual approval.".to_string()),
                            },
                        ],
                    },
                    GovernanceRule {
                        selector: ToolSelector { tool: "rm".to_string() },
                        permissions: vec![
                            ToolPermission {
                                permission_type: PermissionType::RequireApproval,
                                patterns: vec![".*".to_string()],
                                message: Some("Destructive file removal requires manual approval.".to_string()),
                            },
                        ],
                    },
                ],
                personas: vec![
                    SwarmPersona {
                        id: "architect".to_string(),
                        name: "Architect".to_string(),
                        role: "Lead Designer".to_string(),
                        expertise: vec!["architecture".to_string(), "design-patterns".to_string(), "systems".to_string()],
                        tools: vec!["gitnexus_query".to_string(), "gitnexus_impact".to_string()],
                        governance_tier: "elevated".to_string(),
                    },
                    SwarmPersona {
                        id: "developer".to_string(),
                        name: "Developer".to_string(),
                        role: "Feature Implementation".to_string(),
                        expertise: vec!["rust".to_string(), "react".to_string(), "typescript".to_string()],
                        tools: vec!["write_to_file".to_string(), "replace_file_content".to_string()],
                        governance_tier: "standard".to_string(),
                    },
                    SwarmPersona {
                        id: "auditor".to_string(),
                        name: "Security Auditor".to_string(),
                        role: "Safety & Quality".to_string(),
                        expertise: vec!["security".to_string(), "testing".to_string()],
                        tools: vec!["gitnexus_detect_changes".to_string(), "run_command".to_string()],
                        governance_tier: "restricted".to_string(),
                    },
                ],
            },
        }
    }

    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        let policy: SwarmPolicy = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;
        Ok(Self { policy })
    }

    pub fn save_to_file<P: AsRef<Path>>(&self, path: P) -> Result<(), String> {
        let content = serde_yaml::to_string(&self.policy).map_err(|e| e.to_string())?;
        fs::write(path, content).map_err(|e| e.to_string())
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
