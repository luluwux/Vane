use std::sync::{Arc, Mutex};
use std::process::Stdio;
use tauri::{AppHandle, Manager, Emitter};

use crate::config::preset::Preset;
use crate::engine::{error::EngineError, process::ProcessHandle};
use crate::engine::sanitizer::validate_preset_args;
use crate::privilege::checker::is_elevated;

#[cfg(target_os = "windows")]
use crate::engine::job::JobObjectGuard;


// Enum representing engine status.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
#[serde(tag = "variant", rename_all = "camelCase")]
pub enum EngineStatus {
    Stopped,
    Starting,
    Running { pid: u32 },
    Error { message: String },
}

pub struct EngineManager {
    status: Arc<Mutex<EngineStatus>>,
    process: Arc<Mutex<Option<ProcessHandle>>>,
}

impl EngineManager {
    pub fn new() -> Self {
        Self {
            status: Arc::new(Mutex::new(EngineStatus::Stopped)),
            process: Arc::new(Mutex::new(None)),
        }
    }

    // Safely resolves binary path from Resource along with its DLLs
    fn resolve_binary_path(app: &AppHandle) -> Result<std::path::PathBuf, EngineError> {
        let path = app
            .path()
            .resolve("binaries/winws-x86_64-pc-windows-msvc.exe", tauri::path::BaseDirectory::Resource)
            .map_err(|e| EngineError::BinaryNotFound(format!("Tauri Path resolve hatası: {}", e)))?;
            
        if !path.exists() {
            return Err(EngineError::BinaryNotFound(
                format!("WinWS bulunamadı. Lütfen binaries klasörünün bozulmadığına emin olun. Aranan Yol: {}", path.display())
            ));
        }
        
        Ok(path)
    }

    pub fn start(&self, preset: &Preset, app: &AppHandle) -> Result<(), EngineError> {
        if !is_elevated() {
            return Err(EngineError::InsufficientPrivileges);
        }

        /* 
           Defense-in-depth — validate args before any process is spawned.
           This catches malicious presets that bypassed frontend validation
           (e.g., remote preset injection, direct IPC manipulation). 
        */
        validate_preset_args(&preset.args)?;

        {
            let process_lock = self.process.lock()
                .map_err(|_| EngineError::IoError("Process lock zehirlendi".into()))?;
            if process_lock.is_some() {
                return Err(EngineError::AlreadyRunning);
            }
        }

        self.set_status(EngineStatus::Starting, app);

        let winws_path = Self::resolve_binary_path(app)?;

        /* 
           Setting up the working directory is critical for DLL resolution.
           winws.exe must run from the same directory as WinDivert.dll. 
        */
        let working_dir = winws_path.parent()
            .ok_or_else(|| EngineError::BinaryNotFound(
                format!("Binary path'in parent klasörü alınamadı: {:?}", winws_path)
            ))?;

        let mut child = tokio::process::Command::new(&winws_path)
            .args(&preset.args)
            .current_dir(working_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            // CREATE_NO_WINDOW
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|e| {
                tracing::error!("Süreç başlatılamadı: {}", e);
                self.set_status(EngineStatus::Error { message: format!("Engine spawn hatası: {}", e) }, app);
                EngineError::SpawnFailed(e.to_string())
            })?;

        let pid = child.id().unwrap_or(0);
        tracing::info!("Engine başarıyla başlatıldı, PID: {}", pid);

        /* 
           Assign the child to a Job Object so that if Vane is killed by the OS
           (e.g., Task Manager), the kernel will terminate winws.exe automatically. 
        */
        #[cfg(target_os = "windows")]
        let job_guard = match JobObjectGuard::new().and_then(|j| j.assign(pid).map(|_| j)) {
            Ok(j) => {
                tracing::info!("winws PID {} Job Object'a atandı.", pid);
                Some(j)
            }
            Err(e) => {
                /* 
                   Graceful degradation: Job Objects are best-effort.
                   The RAII Drop on ProcessHandle still handles normal shutdown. 
                */
                tracing::warn!("Job Object atanamadı (graceful degradation): {}", e);
                None
            }
        };


        let mut stdout = child.stdout.take()
            .ok_or_else(|| EngineError::IoError("stdout pipe oluşturulamadı (OS pipe limiti?)".into()))?;
        let mut stderr = child.stderr.take()
            .ok_or_else(|| EngineError::IoError("stderr pipe oluşturulamadı (OS pipe limiti?)".into()))?;

        let app_clone = app.clone();
        
        // Stdout task
        tauri::async_runtime::spawn(async move {
            use tokio::io::AsyncReadExt;
            let mut buf = [0u8; 512];
            let mut current_line = String::new();
            
            while let Ok(n) = stdout.read(&mut buf).await {
                if n == 0 { break; } // EOF
                let text = String::from_utf8_lossy(&buf[..n]);
                for c in text.chars() {
                    if c == '\n' || c == '\r' {
                        if !current_line.is_empty() {
                            tracing::debug!("winws stdout: {}", current_line);
                            let _ = app_clone.emit("log_line", current_line.clone());
                            current_line.clear();
                        }
                    } else {
                        current_line.push(c);
                    }
                }
            }
            if !current_line.is_empty() {
                let _ = app_clone.emit("log_line", current_line);
            }
        });

        let app_clone2 = app.clone();
        
        // Stderr task
        tauri::async_runtime::spawn(async move {
            use tokio::io::AsyncReadExt;
            let mut buf = [0u8; 512];
            let mut current_line = String::new();
            
            while let Ok(n) = stderr.read(&mut buf).await {
                if n == 0 { break; } // EOF
                let text = String::from_utf8_lossy(&buf[..n]);
                for c in text.chars() {
                    if c == '\n' || c == '\r' {
                        if !current_line.is_empty() {
                            tracing::warn!("winws stderr: {}", current_line);
                            let _ = app_clone2.emit("log_line", format!("HATA: {}", current_line));
                            current_line.clear();
                        }
                    } else {
                        current_line.push(c);
                    }
                }
            }
        });

        #[cfg(target_os = "windows")]
        let handle = ProcessHandle::new(child, pid, job_guard);
        #[cfg(not(target_os = "windows"))]
        let handle = ProcessHandle::new(child, pid);


        {
            let mut process_lock = self.process.lock()
                .map_err(|_| EngineError::IoError("Process lock zehirlendi".into()))?;
            *process_lock = Some(handle);
        }

        self.set_status(EngineStatus::Running { pid }, app);
        tracing::info!("Engine started: preset='{}', pid={}", preset.id, pid);

        Ok(())
    }

    pub fn stop(&self, app: &AppHandle) -> Result<(), EngineError> {
        let mut process_lock = self.process.lock()
            .map_err(|_| EngineError::IoError("Process lock zehirlendi".into()))?;

        let mut handle = process_lock.take().ok_or(EngineError::NotRunning)?;

        /* 
           Graceful shutdown: give winws 500ms to finish processing current
           network packets before forcing termination. 
        */
        handle.kill_graceful();

        self.set_status(EngineStatus::Stopped, app);
        tracing::info!("Engine stopped.");

        Ok(())
    }

    pub fn current_status(&self) -> EngineStatus {
        self.status
            .lock()
            .map(|s| s.clone())
            .unwrap_or(EngineStatus::Stopped)
    }

    fn set_status(&self, new_status: EngineStatus, app: &AppHandle) {
        if let Ok(mut guard) = self.status.lock() {
            *guard = new_status.clone();
        }
        let _ = app.emit("engine_status", &new_status);
    }
}
