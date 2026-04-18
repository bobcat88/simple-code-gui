use tts::{Tts, UtteranceId};
use std::sync::Mutex;
use tauri::State;

pub struct VoiceManager {
    tts: Mutex<Option<Tts>>,
}

impl VoiceManager {
    pub fn new() -> Self {
        let tts = Tts::default().ok();
        Self {
            tts: Mutex::new(tts),
        }
    }

    pub fn speak(&self, text: &str) -> Result<Option<UtteranceId>, String> {
        let mut tts_lock = self.tts.lock().unwrap();
        if tts_lock.is_none() {
            *tts_lock = Tts::default().ok();
        }

        if let Some(tts) = tts_lock.as_mut() {
            tts.speak(text, true).map_err(|e| e.to_string())
        } else {
            Err("TTS engine not available".to_string())
        }
    }

    pub fn stop(&self) -> Result<(), String> {
        let mut tts_lock = self.tts.lock().unwrap();
        if let Some(tts) = tts_lock.as_mut() {
            tts.stop().map_err(|e| e.to_string())
        } else {
            Ok(())
        }
    }
}

#[tauri::command]
pub async fn voice_speak(state: State<'_, VoiceManager>, text: String) -> Result<(), String> {
    state.speak(&text).map(|_| ())
}

#[tauri::command]
pub async fn voice_stop(state: State<'_, VoiceManager>) -> Result<(), String> {
    state.stop()
}
