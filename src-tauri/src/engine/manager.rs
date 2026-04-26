use std::sync::{Arc, Mutex};
use std::process::Stdio;
use tauri::{AppHandle, Manager, Emitter};

use crate::config::preset::Preset;
use crate::engine::{error::EngineError, process::ProcessHandle};
use crate::engine::sanitizer::validate_preset_args;
use crate::privilege::checker::is_elevated;

#[cfg(target_os = "windows")]
use crate::engine::job::JobObjectGuard;

const CREATE_NO_WINDOW: u32 = 0x08000000;

// Enum representing engine status.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
#[serde(tag = "variant", rename_all = "camelCase")]
pub enum EngineStatus {
    Stopped,
    Starting,
    Running { pid: u32 },
    Error { 
        message: String, 
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<String> 
    },
}

pub trait EngineEventDispatcher: Send + Sync {
    fn emit_log_batch(&self, batch: Vec<String>);
    fn emit_status(&self, status: &EngineStatus);
    fn resolve_path(&self, path: &str, base: tauri::path::BaseDirectory) -> Result<std::path::PathBuf, tauri::Error>;
}

impl EngineEventDispatcher for AppHandle {
    fn emit_log_batch(&self, batch: Vec<String>) {
        let _ = self.emit("log_batch", batch);
    }

    fn emit_status(&self, status: &EngineStatus) {
        let _ = self.emit("engine_status", status);
    }
    
    fn resolve_path(&self, path: &str, base: tauri::path::BaseDirectory) -> Result<std::path::PathBuf, tauri::Error> {
        self.path().resolve(path, base)
    }
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
    #[cfg(target_os = "windows")]
    fn resolve_binary_path(dispatcher: &impl EngineEventDispatcher) -> Result<std::path::PathBuf, EngineError> {
        let path = dispatcher
            .resolve_path("binaries/winws-x86_64-pc-windows-msvc.exe", tauri::path::BaseDirectory::Resource)
            .map_err(|e| EngineError::BinaryNotFound(format!("Tauri Path resolve hatası: {}", e)))?;
            
        if !path.exists() {
            return Err(EngineError::BinaryNotFound(
                format!("WinWS bulunamadı. Lütfen binaries klasörünün bozulmadığına emin olun. Aranan Yol: {}", path.display())
            ));
        }
        
        Ok(path)
    }

    // Safely resolves binary path for Linux (nfqws)
    #[cfg(target_os = "linux")]
    fn resolve_binary_path(dispatcher: &impl EngineEventDispatcher) -> Result<std::path::PathBuf, EngineError> {
        let path = dispatcher
            .resolve_path("binaries/nfqws-x86_64-unknown-linux-gnu", tauri::path::BaseDirectory::Resource)
            .map_err(|e| EngineError::BinaryNotFound(format!("Tauri Path resolve hatası: {}", e)))?;
            
        if !path.exists() {
            return Err(EngineError::BinaryNotFound(
                format!("nfqws bulunamadı. Lütfen binaries klasörünün bozulmadığına emin olun. Aranan Yol: {}", path.display())
            ));
        }
        
        Ok(path)
    }

    // Argüman Çeviricisi: Windows argümanlarını Linux için optimize eder
    #[cfg(target_os = "windows")]
    fn prepare_args(preset_args: &[String]) -> Vec<String> {
        preset_args.to_vec()
    }

    #[cfg(target_os = "linux")]
    fn prepare_args(preset_args: &[String]) -> Vec<String> {
        let mut final_args = Vec::new();
        let mut skip_next = false;
        
        for arg in preset_args {
            if skip_next {
                skip_next = false;
                continue;
            }
            
            // Eğer argüman --windivert=... formatındaysa
            if arg.starts_with("--windivert=") {
                continue;
            }

            // Eğer argüman `--windivert` ise ve değer hemen arkasından geliyorsa
            if arg == "--windivert" {
                skip_next = true;
                continue;
            }

            final_args.push(arg.clone());
        }
        
        // nfqws'in dinleyeceği kuyruk numarasını (Faz 3 ile aynı numara) ekle
        final_args.push("--qnum=200".to_string());
        
        final_args
    }

    pub fn start<D: EngineEventDispatcher + Clone + 'static>(&self, preset: &Preset, dispatcher: &D) -> Result<(), EngineError> {
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
                .map_err(|_| {
                    tracing::error!("Process lock zehirlendi. Kritik durum.");
                    self.set_status(EngineStatus::Error { message: "Internal Error: State poisoned".into(), code: None }, dispatcher);
                    EngineError::IoError("Process lock zehirlendi".into())
                })?;
            if process_lock.is_some() {
                return Err(EngineError::AlreadyRunning);
            }
        }

        self.set_status(EngineStatus::Starting, dispatcher);

        let winws_path = Self::resolve_binary_path(dispatcher)?;

        /* 
           Setting up the working directory is critical for DLL resolution.
           winws.exe must run from the same directory as WinDivert.dll. 
        */
        let working_dir = winws_path.parent()
            .ok_or_else(|| EngineError::BinaryNotFound(
                format!("Binary path'in parent klasörü alınamadı: {:?}", winws_path)
            ))?;

        let prepared_args = Self::prepare_args(&preset.args);

        let mut command = std::process::Command::new(&winws_path);
        command.args(&prepared_args)
            .current_dir(working_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        #[cfg(target_os = "linux")]
        {
            use std::os::unix::process::CommandExt;
            unsafe {
                command.pre_exec(|| {
                    libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGKILL);
                    Ok(())
                });
            }
        }

        #[cfg(target_os = "linux")]
        let route_guard = match crate::network::router::NetworkRouteGuard::new(200) {
            Ok(guard) => Some(guard),
            Err(e) => {
                self.set_status(EngineStatus::Error { message: e.to_string(), code: Some(e.code().to_string()) }, dispatcher);
                return Err(e);
            }
        };

        let mut child = tokio::process::Command::from(command)
            .spawn()
            .map_err(|e| {
                tracing::error!("Süreç başlatılamadı: {}", e);
                self.set_status(EngineStatus::Error { message: format!("Engine spawn hatası: {}", e), code: Some("SPAWN_FAILED".into()) }, dispatcher);
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
                tracing::error!("Job Object atanamadı, motor başlatılmıyor: {}", e);
                // Attempt to kill child since we failed to guard it
                let _ = child.start_kill();
                let _ = tauri::async_runtime::block_on(child.wait());
                self.set_status(EngineStatus::Error { message: "Job Object oluşturulamadı".into(), code: Some("JOB_OBJECT_ERROR".into()) }, dispatcher);
                return Err(EngineError::IoError(
                    format!("Kernel-level process guard (Job Object) oluşturulamadı: {}. Güvenlik gereksinimi karşılanamadı.", e)
                ));
            }
        };

        let stdout = child.stdout.take()
            .ok_or_else(|| EngineError::IoError("stdout pipe oluşturulamadı (OS pipe limiti?)".into()))?;
        let stderr = child.stderr.take()
            .ok_or_else(|| EngineError::IoError("stderr pipe oluşturulamadı (OS pipe limiti?)".into()))?;

        let dispatcher_clone1 = dispatcher.clone();
        let dispatcher_clone2 = dispatcher.clone();
        
        crate::engine::logger::spawn_log_reader(stdout, dispatcher_clone1, None);
        crate::engine::logger::spawn_log_reader(stderr, dispatcher_clone2, Some("HATA: "));

        #[cfg(target_os = "windows")]
        let handle = ProcessHandle::new(child, pid, job_guard);
        #[cfg(target_os = "linux")]
        let handle = ProcessHandle::new(child, pid, route_guard);


        {
            let mut process_lock = self.process.lock()
                .map_err(|_| {
                    tracing::error!("Process lock zehirlendi (kaydetme aşaması).");
                    self.set_status(EngineStatus::Error { message: "Internal Error: State poisoned".into(), code: None }, dispatcher);
                    EngineError::IoError("Process lock zehirlendi".into())
                })?;
            *process_lock = Some(handle);
        }

        self.set_status(EngineStatus::Running { pid }, dispatcher);
        tracing::info!("Engine started: preset='{}', pid={}", preset.id, pid);

        Ok(())
    }

    pub fn stop(&self, dispatcher: &impl EngineEventDispatcher) -> Result<(), EngineError> {
        let mut process_lock = self.process.lock()
            .map_err(|_| {
                tracing::error!("Process lock zehirlendi (durdurma aşaması).");
                self.set_status(EngineStatus::Error { message: "Internal Error: State poisoned".into(), code: None }, dispatcher);
                EngineError::IoError("Process lock zehirlendi".into())
            })?;

        let mut handle = process_lock.take().ok_or(EngineError::NotRunning)?;

        /* 
           Graceful shutdown: give winws 500ms to finish processing current
           network packets before forcing termination. 
        */
        handle.kill_graceful();

        self.set_status(EngineStatus::Stopped, dispatcher);
        tracing::info!("Engine stopped.");

        Ok(())
    }

    pub fn current_status(&self) -> EngineStatus {
        self.status
            .lock()
            .map(|s| s.clone())
            .unwrap_or(EngineStatus::Stopped)
    }

    fn set_status(&self, new_status: EngineStatus, dispatcher: &impl EngineEventDispatcher) {
        if let Ok(mut guard) = self.status.lock() {
            *guard = new_status.clone();
        } else {
            tracing::error!("Status lock zehirlendi. Durum güncellenemiyor.");
        }
        dispatcher.emit_status(&new_status);
    }
}
