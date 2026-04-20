use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::io::{self, Read, Write};
use tauri::{AppHandle, Manager, State, Emitter};
use std::sync::Arc;
use parking_lot::Mutex;
use tts::Tts;
use tar::Archive;
use flate2::read::GzDecoder;
use zip::ZipArchive;
use tokio::io::AsyncWriteExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstallationProgress {
    pub r#type: String, // "piper", "piper-voice"
    pub status: String,
    pub percent: f32,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TTSResult {
    pub success: bool,
    pub audio_data: Option<String>, // Base64 WAV
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TTSStatus {
    pub installed: bool,
    pub engine: String,
    pub voices: Vec<String>,
}

pub struct VoiceManager {
    pub system_tts: Arc<Mutex<Option<Tts>>>,
}

impl VoiceManager {
    pub fn new() -> Self {
        let system_tts = Tts::default().ok();
        Self {
            system_tts: Arc::new(Mutex::new(system_tts)),
        }
    }

    pub fn get_bin_dir(&self, app_handle: &AppHandle) -> PathBuf {
        let dir = app_handle.path().app_config_dir().unwrap().join("bin");
        if !dir.exists() {
            fs::create_dir_all(&dir).unwrap();
        }
        dir
    }

    pub fn get_voices_dir(&self, app_handle: &AppHandle) -> PathBuf {
        let dir = app_handle.path().app_config_dir().unwrap().join("voices");
        if !dir.exists() {
            fs::create_dir_all(&dir).unwrap();
        }
        dir
    }

    pub fn get_piper_path(&self, app_handle: &AppHandle) -> PathBuf {
        let bin_dir = self.get_bin_dir(app_handle);
        #[cfg(target_os = "windows")]
        return bin_dir.join("piper").join("piper.exe");
        #[cfg(not(target_os = "windows"))]
        return bin_dir.join("piper").join("piper");
    }

    pub fn is_piper_installed(&self, app_handle: &AppHandle) -> bool {
        self.get_piper_path(app_handle).exists()
    }

    pub fn get_available_voices(&self, app_handle: &AppHandle) -> Vec<String> {
        let voices_dir = self.get_voices_dir(app_handle);
        let mut voices = Vec::new();
        if let Ok(entries) = fs::read_dir(voices_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("onnx") {
                    if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                        voices.push(name.to_string());
                    }
                }
            }
        }
        voices
    }
}

#[tauri::command]
pub async fn voice_check_tts(app: AppHandle, state: State<'_, VoiceManager>) -> Result<TTSStatus, String> {
    Ok(TTSStatus {
        installed: state.is_piper_installed(&app),
        engine: "piper".to_string(),
        voices: state.get_available_voices(&app),
    })
}

#[tauri::command]
pub async fn voice_install_piper(app: AppHandle, state: State<'_, VoiceManager>) -> Result<TTSResult, String> {
    if state.is_piper_installed(&app) {
        return Ok(TTSResult { success: true, audio_data: None, error: None });
    }

    let bin_dir = state.get_bin_dir(&app);
    
    // Determine download URL based on OS
    let (url, filename) = if cfg!(target_os = "windows") {
        ("https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_windows_amd64.zip", "piper.zip")
    } else if cfg!(target_os = "macos") {
        ("https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_macos_x64.tar.gz", "piper.tar.gz")
    } else {
        ("https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz", "piper.tar.gz")
    };

    let dest_path = bin_dir.join(filename);
    
    // Emit starting event
    let _ = app.emit("install-progress", InstallationProgress {
        r#type: "piper".to_string(),
        status: "downloading".to_string(),
        percent: 0.0,
        message: format!("Downloading Piper engine from GitHub..."),
    });

    // Download
    let mut response = reqwest::get(url).await.map_err(|e| e.to_string())?;
    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded = 0u64;
    let mut file = tokio::fs::File::create(&dest_path).await.map_err(|e| e.to_string())?;

    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        
        if total_size > 0 {
            let percent = (downloaded as f32 / total_size as f32) * 100.0;
            let _ = app.emit("install-progress", InstallationProgress {
                r#type: "piper".to_string(),
                status: "downloading".to_string(),
                percent,
                message: format!("Downloading Piper engine: {:.1}%", percent),
            });
        }
    }
    file.flush().await.map_err(|e| e.to_string())?;

    // Extract (blocking operations, move to spawn_blocking)
    let _ = app.emit("install-progress", InstallationProgress {
        r#type: "piper".to_string(),
        status: "extracting".to_string(),
        percent: 100.0,
        message: "Extracting Piper engine...".to_string(),
    });

    let dp = dest_path.clone();
    let bd = bin_dir.clone();
    let fname = filename.to_string();

    tokio::task::spawn_blocking(move || {
        if fname.ends_with(".zip") {
            let file = File::open(&dp).map_err(|e| e.to_string())?;
            let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
            archive.extract(&bd).map_err(|e| e.to_string())?;
        } else {
            let file = File::open(&dp).map_err(|e| e.to_string())?;
            let tar = GzDecoder::new(file);
            let mut archive = Archive::new(tar);
            archive.unpack(&bd).map_err(|e| e.to_string())?;
        }
        Ok::<(), String>(())
    }).await.map_err(|e| e.to_string())??;

    // Cleanup archive
    let _ = fs::remove_file(&dest_path);

    // Set permissions on Unix
    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let piper_exe = state.get_piper_path(&app);
        if let Ok(mut perms) = fs::metadata(&piper_exe).map(|m| m.permissions()) {
            perms.set_mode(0o755);
            let _ = fs::set_permissions(&piper_exe, perms);
        }
    }

    let _ = app.emit("install-progress", InstallationProgress {
        r#type: "piper".to_string(),
        status: "completed".to_string(),
        percent: 100.0,
        message: "Piper engine installed successfully.".to_string(),
    });

    Ok(TTSResult { success: true, audio_data: None, error: None })
}

#[tauri::command]
pub async fn voice_install_voice(app: AppHandle, state: State<'_, VoiceManager>, model_id: String) -> Result<TTSResult, String> {
    let voices_dir = state.get_voices_dir(&app);
    let onnx_path = voices_dir.join(format!("{}.onnx", model_id));
    let json_path = voices_dir.join(format!("{}.onnx.json", model_id));

    if onnx_path.exists() && json_path.exists() {
        return Ok(TTSResult { success: true, audio_data: None, error: None });
    }

    // Parse model_id to construct Hugging Face URL
    // Expected format: "en_US-libritts_r-medium"
    let parts: Vec<&str> = model_id.split('-').collect();
    if parts.len() < 2 {
        return Err("Invalid model ID format".to_string());
    }
    
    let lang = parts[0].split('_').next().unwrap_or("en");
    let full_lang = parts[0];
    let model_name = parts[1];
    let quality = parts.get(2).unwrap_or(&"medium");

    let base_url = format!(
        "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/{}/{}/{}/{}",
        lang, full_lang, model_name, quality
    );
    
    let onnx_url = format!("{}/{}.onnx", base_url, model_id);
    let json_url = format!("{}/{}.onnx.json", base_url, model_id);

    // Download both files
    for (url, dest) in [(&onnx_url, onnx_path), (&json_url, json_path)] {
        let _ = app.emit("install-progress", InstallationProgress {
            r#type: "piper-voice".to_string(),
            status: "downloading".to_string(),
            percent: 0.0,
            message: format!("Downloading voice model file for {}...", model_id),
        });

        let mut response = reqwest::get(url).await.map_err(|e| e.to_string())?;
        let mut file = tokio::fs::File::create(&dest).await.map_err(|e| e.to_string())?;
        
        while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
            file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        }
        file.flush().await.map_err(|e| e.to_string())?;
    }

    let _ = app.emit("install-progress", InstallationProgress {
        r#type: "piper-voice".to_string(),
        status: "completed".to_string(),
        percent: 100.0,
        message: format!("Voice {} installed.", model_id),
    });

    Ok(TTSResult { success: true, audio_data: None, error: None })
}

#[tauri::command]
pub async fn voice_get_installed(app: AppHandle, state: State<'_, VoiceManager>) -> Result<Vec<String>, String> {
    Ok(state.get_available_voices(&app))
}

#[tauri::command]
pub async fn voice_speak(
    app: AppHandle, 
    state: State<'_, VoiceManager>, 
    text: String, 
    voice: Option<String>,
    speed: Option<f32>
) -> Result<TTSResult, String> {
    if state.is_piper_installed(&app) {
        let piper_exe = state.get_piper_path(&app);
        let voices_dir = state.get_voices_dir(&app);
        
        // Use provided voice or find first available
        let selected_voice = voice.or_else(|| {
            state.get_available_voices(&app).first().cloned()
        });

        if let Some(voice_name) = selected_voice {
            let model_path = voices_dir.join(format!("{}.onnx", voice_name));
            if model_path.exists() {
                let temp_wav = std::env::temp_dir().join(format!("piper_{}.wav", uuid::Uuid::new_v4()));

                let mut cmd = Command::new(&piper_exe);
                cmd.arg("--model").arg(&model_path)
                   .arg("--output_file").arg(&temp_wav);
                
                if let Some(s) = speed {
                    cmd.arg("--length_scale").arg((1.0 / s).to_string());
                }

                let mut child = cmd.stdin(Stdio::piped())
                    .spawn()
                    .map_err(|e| e.to_string())?;

                if let Some(mut stdin) = child.stdin.take() {
                    stdin.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
                }

                let status = child.wait().map_err(|e| e.to_string())?;
                if status.success() && temp_wav.exists() {
                    let mut file = File::open(&temp_wav).map_err(|e| e.to_string())?;
                    let mut buffer = Vec::new();
                    file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
                    
                    // Cleanup
                    let _ = fs::remove_file(&temp_wav);

                    let base64_data = base64_encode(&buffer);
                    return Ok(TTSResult {
                        success: true,
                        audio_data: Some(base64_data),
                        error: None,
                    });
                } else {
                    return Err(format!("Piper failed with status: {}", status));
                }
            }
        }
    }

    // Fallback to system TTS
    let mut system_tts = state.system_tts.lock();
    if let Some(tts) = system_tts.as_mut() {
        if let Ok(_) = tts.speak(text, true) {
            return Ok(TTSResult {
                success: true,
                audio_data: None,
                error: None,
            });
        }
    }

    Err("No TTS engine available".to_string())
}

#[tauri::command]
pub async fn voice_stop(state: State<'_, VoiceManager>) -> Result<(), String> {
    let mut system_tts = state.system_tts.lock();
    if let Some(tts) = system_tts.as_mut() {
        let _ = tts.stop();
    }
    Ok(())
}

fn base64_encode(input: &[u8]) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::with_capacity((input.len() + 2) / 3 * 4);
    
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = chunk.get(1).map(|&b| b as usize).unwrap_or(0);
        let b2 = chunk.get(2).map(|&b| b as usize).unwrap_or(0);

        output.push(CHARSET[b0 >> 2] as char);
        output.push(CHARSET[((b0 & 0x03) << 4) | (b1 >> 4)] as char);
        
        if chunk.len() > 1 {
            output.push(CHARSET[((b1 & 0x0f) << 2) | (b2 >> 6)] as char);
        } else {
            output.push('=');
        }
        
        if chunk.len() > 2 {
            output.push(CHARSET[b2 & 0x3f] as char);
        } else {
            output.push('=');
        }
    }
    output
}
