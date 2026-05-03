use serde::Serialize;
use tauri::command;
use local_ip_address::local_ip;

#[derive(Debug, Serialize)]
pub struct ConnectionInfo {
    pub success: bool,
    pub ip: Option<String>,
    pub port: Option<u16>,
    pub token: Option<String>,
    pub error: Option<String>,
}

#[command]
pub async fn mobile_get_connection_info() -> Result<ConnectionInfo, String> {
    match local_ip() {
        Ok(ip) => Ok(ConnectionInfo {
            success: true,
            ip: Some(ip.to_string()),
            port: Some(4747), // Default Insight/Sync port
            token: Some("demo-token-123".to_string()), // TODO: Generate/fetch real token
            error: None,
        }),
        Err(e) => Ok(ConnectionInfo {
            success: false,
            ip: None,
            port: None,
            token: None,
            error: Some(format!("Failed to get local IP: {}", e)),
        }),
    }
}

#[command]
pub async fn mobile_regenerate_token() -> Result<String, String> {
    // TODO: Implement real token regeneration logic in database
    Ok("new-demo-token-456".to_string())
}
