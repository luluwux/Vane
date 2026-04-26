

use crate::config::preset::{builtin_presets, Preset};
use crate::engine::error::EngineError;
use crate::engine::sanitizer::validate_preset_args;

/* 
   Structure responsible for loading and querying presets.
   Separation of Concerns (Single Responsibility):
   - JSON parsing → this layer
   - Binary spawning → EngineManager
   - UI state → frontend store 
*/
pub struct ConfigLoader {
    presets: Vec<Preset>,
}

/* 
   Security: Ensures the ID only contains alphanumeric characters, hyphens, or underscores.
   Prevents Path Traversal vulnerabilities (e.g. `../`). 
*/
fn is_valid_id(id: &str) -> bool {
    !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

impl Default for ConfigLoader {
    fn default() -> Self {
        Self::new()
    }
}

impl ConfigLoader {
/* 
   Loads built-in presets. User custom preset directory
   is appended later via `load_custom_presets_from`. 
*/
    pub fn new() -> Self {
        Self {
            presets: builtin_presets(),
        }
    }

/* 
   Loads custom preset JSON files from user's AppData directory.
   Skips corrupted files (does not emit critical errors to user). 
*/
    pub fn load_custom_presets_from(&mut self, dir: &std::path::Path) {
        let Ok(entries) = std::fs::read_dir(dir) else {
            return;
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }

            let Ok(content) = std::fs::read_to_string(&path) else {
                tracing::warn!("Custom preset okunamadı: {:?}", path);
                continue;
            };

            match serde_json::from_str::<Preset>(&content) {
                Ok(mut preset) => {
                    preset.is_custom = true;
                    // Prevent collision with built-in presets
                    if !self.presets.iter().any(|p| p.id == preset.id) {
                        self.presets.push(preset);
                    }
                }
                Err(e) => {
                    tracing::warn!("Custom preset parse hatası {:?}: {}", path, e);
                }
            }
        }
    }

// Returns all presets (built-in + custom).
    pub fn all_presets(&self) -> Vec<Preset> {
        self.presets.clone()
    }

// Finds a preset by ID; returns `None` if not found.
    pub fn find_preset(&self, id: &str) -> Option<Preset> {
        self.presets.iter().find(|p| p.id == id).cloned()
    }

// Saves a new custom preset and adds it to memory.
    pub fn save_custom_preset(&mut self, preset: Preset, dir: &std::path::Path) -> Result<(), EngineError> {
        if !is_valid_id(&preset.id) {
            return Err(EngineError::InvalidId(preset.id.clone()));
        }

        /* 
           Security: authoritative validation of arguments before disk persistence.
           This prevents "Import JSON" or malformed custom preset paths from
           storing dangerous shell-injection payloads. 
        */
        validate_preset_args(&preset.args)?;

        let filename = format!("{}.json", preset.id);
        let path = dir.join(filename);

        let content = serde_json::to_string_pretty(&preset)
            .map_err(|e| EngineError::ConfigParseError(e.to_string()))?;

        std::fs::create_dir_all(dir)
            .map_err(|e| EngineError::IoError(e.to_string()))?;

        std::fs::write(&path, content)
            .map_err(|e| EngineError::IoError(e.to_string()))?;

        // Update the in-memory list
        if let Some(existing) = self.presets.iter_mut().find(|p| p.id == preset.id) {
            *existing = preset;
        } else {
            self.presets.push(preset);
        }

        Ok(())
    }

/* 
   Loads presets fetched from a remote source (GitHub Gist, CDN, etc.).
   Remote presets are appended after built-in and custom presets.
   Presets with colliding IDs are silently skipped to prevent
   a malicious remote source from overwriting built-in presets. 
*/
    pub fn load_remote_presets(&mut self, remote_presets: Vec<crate::config::preset::Preset>) {
        let mut added = 0usize;
        for preset in remote_presets {
            if !self.presets.iter().any(|p| p.id == preset.id) {
                self.presets.push(preset);
                added += 1;
            }
        }
        tracing::info!("Remote presets yüklendi: {} yeni preset eklendi.", added);
    }

// Deletes the custom preset with the specified ID.
    pub fn delete_custom_preset(&mut self, id: &str, dir: &std::path::Path) -> Result<(), EngineError> {
        if !is_valid_id(id) {
            return Err(EngineError::InvalidId(id.to_string()));
        }

        let filename = format!("{}.json", id);
        let path = dir.join(filename);

        if path.exists() {
            std::fs::remove_file(&path)
                .map_err(|e| EngineError::IoError(e.to_string()))?;
        }

        self.presets.retain(|p| p.id != id);
        Ok(())
    }
}
