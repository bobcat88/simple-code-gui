use std::env;
use std::path::{Path, PathBuf};

pub fn is_windows() -> bool {
    cfg!(windows)
}

pub fn get_path_sep() -> &'static str {
    if is_windows() { ";" } else { ":" }
}

pub fn get_home_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"))
}

pub fn get_additional_paths() -> Vec<PathBuf> {
    let home = get_home_dir();
    let mut paths = Vec::new();

    if is_windows() {
        if let Ok(app_data) = env::var("APPDATA") {
            paths.push(Path::new(&app_data).join("npm"));
        }
        if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
            paths.push(Path::new(&local_app_data).join("Programs").join("nodejs"));
        }
        paths.push(home.join("AppData").join("Local").join("bin"));
        paths.push(home.join(".local").join("bin"));
        paths.push(home.join(".cargo").join("bin"));
    } else {
        paths.push(home.join(".nvm/versions/node/v20.18.1/bin"));
        paths.push(home.join(".nvm/versions/node/v22.11.0/bin"));
        paths.push(home.join(".local/bin"));
        paths.push(home.join(".npm-global/bin"));
        paths.push(home.join(".bun/bin"));
        paths.push(home.join(".cargo/bin"));
        paths.push(PathBuf::from("/usr/local/bin"));
    }
    paths
}

pub fn get_enhanced_path(portable_dirs: &[PathBuf]) -> String {
    let mut all_paths = Vec::new();
    
    // Add portable dirs first
    for dir in portable_dirs {
        all_paths.push(dir.to_string_lossy().into_owned());
    }
    
    // Add additional system paths
    for dir in get_additional_paths() {
        all_paths.push(dir.to_string_lossy().into_owned());
    }
    
    // Add current path
    if let Ok(current_path) = env::var("PATH") {
        all_paths.push(current_path);
    }
    
    all_paths.join(get_path_sep())
}
