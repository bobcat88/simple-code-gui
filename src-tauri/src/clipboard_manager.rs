use arboard::Clipboard;
use serde::Serialize;
use std::fs::File;
use std::io::BufWriter;
use tauri::command;
use tauri::AppHandle;
use tauri::Manager;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct ClipboardImageResult {
    pub success: bool,
    pub has_image: bool,
    pub path: Option<String>,
    pub error: Option<String>,
}

#[command]
pub async fn read_clipboard_image(app: AppHandle) -> Result<ClipboardImageResult, String> {
    let mut clipboard = Clipboard::new().map_err(|e| format!("Failed to open clipboard: {}", e))?;
    
    match clipboard.get_image() {
        Ok(image) => {
            let cache_dir = app.path().app_cache_dir().map_err(|e| format!("Failed to get cache dir: {}", e))?;
            let file_name = format!("clip_{}.png", Uuid::new_v4());
            let file_path = cache_dir.join(file_name);
            
            let file = File::create(&file_path).map_err(|e| format!("Failed to create file: {}", e))?;
            let ref mut w = BufWriter::new(file);
            
            let encoder = png::Encoder::new(w, image.width as u32, image.height as u32);
            let mut writer = encoder.write_header().map_err(|e| format!("Failed to write PNG header: {}", e))?;
            writer.write_image_data(&image.bytes).map_err(|e| format!("Failed to write PNG data: {}", e))?;
            
            Ok(ClipboardImageResult {
                success: true,
                has_image: true,
                path: Some(file_path.to_string_lossy().to_string()),
                error: None,
            })
        },
        Err(arboard::Error::ContentNotAvailable) => {
            Ok(ClipboardImageResult {
                success: true,
                has_image: false,
                path: None,
                error: None,
            })
        },
        Err(e) => {
            Ok(ClipboardImageResult {
                success: false,
                has_image: false,
                path: None,
                error: Some(format!("Clipboard error: {}", e)),
            })
        }
    }
}
