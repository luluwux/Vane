use std::sync::Mutex;
use std::time::Duration;
use log::LevelFilter;
use tauri::{AppHandle, Manager, State, Emitter, Listener};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// Constant for CREATE_NO_WINDOW flag on Windows to prevent console window flashing.
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub mod config;
pub mod engine;
pub mod privilege;
pub mod http;
pub mod dns;
pub mod autostart;
pub mod presets;
pub mod updater;
pub mod network;

use crate::config::{loader::ConfigLoader, preset::Preset};
use crate::engine::{EngineError, EngineManager, EngineStatus};
use crate::http::{check_url_health, check_dns_block};
use crate::dns::{
    DnsProvider, NetworkAdapter, ApplyDnsResult,
    builtin_providers, get_active_adapters, apply_dns,
    reset_dns_to_dhcp, is_using_trusted_dns,
    resolve_doh, DohResult, DOH_CLOUDFLARE, DOH_GOOGLE,
    ForwarderHandle, DoHEndpoint, spawn_doh_forwarder, DOH_FORWARDER_DEFAULT_PORT,
};
use crate::privilege::checker::is_elevated;
use crate::updater::{check_for_updates, install_update};
use crate::network::spawn_network_watcher;

pub struct AppState {
    pub engine_manager: EngineManager,
    pub config_loader: Mutex<ConfigLoader>,
/* 
   Application-wide shared HTTP client.
   Reuses the connection pool to reduce TCP overhead. 
*/
    pub http_client: reqwest::Client,
/* 
   Active DoH forwarder handle. None if the forwarder is not running.
   Wrapped in Mutex so commands can start/stop it from different threads. 
*/
    pub forwarder: Mutex<Option<ForwarderHandle>>,
}

// ─── Macro: Map Mutex lock error to EngineError ────────────────────────────
macro_rules! lock_or_err {
    ($mutex:expr) => {
        $mutex.lock().map_err(|_| EngineError::IoError("Config lock poisoned".into()))
    };
}

#[tauri::command]
async fn start_engine(
    preset_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<EngineStatus, EngineError> {
    let preset = {
        let loader = lock_or_err!(state.config_loader)?;
        loader
            .find_preset(&preset_id)
            .ok_or(EngineError::InvalidPreset(preset_id))?
    };
    state.engine_manager.start(&preset, &app)?;
    Ok(state.engine_manager.current_status())
}

#[tauri::command]
async fn stop_engine(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), EngineError> {
    state.engine_manager.stop(&app)
}

#[tauri::command]
fn get_engine_status(state: State<'_, AppState>) -> EngineStatus {
    state.engine_manager.current_status()
}

#[tauri::command]
fn list_presets(state: State<'_, AppState>) -> Result<Vec<Preset>, EngineError> {
    let loader = lock_or_err!(state.config_loader)?;
    Ok(loader.all_presets())
}

#[tauri::command]
fn save_custom_preset(
    preset: Preset,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), EngineError> {
    let app_data = app.path().app_data_dir().map_err(|e| EngineError::IoError(e.to_string()))?;
    let custom_dir = app_data.join("presets");
    std::fs::create_dir_all(&custom_dir).map_err(|e| EngineError::IoError(e.to_string()))?;

    lock_or_err!(state.config_loader)?
        .save_custom_preset(preset, &custom_dir)
        .map_err(|e| EngineError::IoError(e.to_string()))
}

#[tauri::command]
fn delete_custom_preset(
    preset_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), EngineError> {
    let custom_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| EngineError::IoError(e.to_string()))?
        .join("presets");

    lock_or_err!(state.config_loader)?
        .delete_custom_preset(&preset_id, &custom_dir)
        .map_err(|e| EngineError::IoError(e.to_string()))
}

use crate::engine::optimizer::{Optimizer, OptimizePayload};

#[tauri::command]
async fn start_auto_optimize(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Preset, EngineError> {
    let optimizer = Optimizer::new(app.clone());

    let _ = app.emit("optimize_progress", OptimizePayload {
        step: "Starting...".into(),
        preset_name: "Preparation".into(),
        progress_pct: 0,
    });

    let best_preset = optimizer
        .run_heuristic_scan()
        .await
        .map_err(|e| EngineError::SpawnFailed(e.to_string()))?;

    state.engine_manager.start(&best_preset, &app)?;
    Ok(best_preset)
}

#[tauri::command]
fn get_last_optimized_preset(app: AppHandle) -> Option<Preset> {
    Optimizer::load_state(&app)
}

#[tauri::command]
fn list_dns_providers() -> Vec<DnsProvider> {
    builtin_providers()
}

#[tauri::command]
fn get_network_adapters() -> Vec<NetworkAdapter> {
    get_active_adapters()
}

#[tauri::command]
fn apply_dns_settings(primary: String, secondary: String, app: AppHandle) -> ApplyDnsResult {
    let res = apply_dns(&primary, &secondary);
    if res.success {
        let _ = app.emit("dns_status_changed", ());
    }
    res
}

#[tauri::command]
fn reset_dns_settings(app: AppHandle) -> ApplyDnsResult {
    let res = reset_dns_to_dhcp();
    if res.success {
        let _ = app.emit("dns_status_changed", ());
    }
    res
}

#[tauri::command]
fn check_trusted_dns() -> bool {
    is_using_trusted_dns()
}

// Performs DNS check before starting the engine.
// If ISP DNS is used, automatically applies Cloudflare DNS and
// notifies the user via the `dns_auto_applied` event.
#[tauri::command]
async fn start_engine_with_dns_guard(
    preset_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<EngineStatus, EngineError> {
    // 1. DNS security check
    let dns_ok = is_using_trusted_dns();
    if !dns_ok {
        let result = apply_dns("1.1.1.1", "1.0.0.1");
        if result.success {
            tracing::info!("DNS Guard: Cloudflare automatically applied.");
            let _ = app.emit("dns_auto_applied", "Cloudflare DNS (1.1.1.1) automatically applied.");
        } else {
            tracing::warn!("DNS Guard: Cloudflare could not be applied — {:?}", result.error);
        }
    }

    // 2. Start engine with current preset
    let preset = {
        let loader = lock_or_err!(state.config_loader)?;
        loader
            .find_preset(&preset_id)
            .ok_or(EngineError::InvalidPreset(preset_id))?
    };
    state.engine_manager.start(&preset, &app)?;

    let _ = app.emit("dns_status_changed", ());

    Ok(state.engine_manager.current_status())
}

#[tauri::command]
async fn open_settings_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.set_focus();
    } else {
        let _ = tauri::WebviewWindowBuilder::new(
            &app,
            "settings",
            tauri::WebviewUrl::App("index.html".into()),
        )
        .title("Vane - Settings")
        .inner_size(750.0, 550.0)
        .center()
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .skip_taskbar(false)
        .build()
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Returns the current system info to display in the HomeView.
#[tauri::command]
fn get_system_info() -> serde_json::Value {
    let os = std::env::consts::OS;
    let device_model = std::env::var("COMPUTERNAME")
        .unwrap_or_else(|_| "Windows Desktop".into());

    serde_json::json!({
        "os": os,
        "device_model": device_model,
    })
}

// ─── Feature 2: Auto-Start Commands ────────────────────────────────────────

/// Returns true if the current process has administrator privileges.
/// Used by the frontend to decide whether to enable the auto-start toggle.
#[tauri::command]
fn check_is_elevated() -> bool {
    is_elevated()
}

#[tauri::command]
fn set_autostart(enabled: bool, _app: AppHandle) -> Result<(), String> {
    if !is_elevated() {
        return Err("Administrator privileges are required for task scheduler registration.".into());
    }

    if enabled {
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Could not get application path: {}", e))?;
        let exe_str = exe_path
            .to_str()
            .ok_or("Application path contains invalid unicode.")?;

        crate::autostart::enable_autostart(exe_str)
    } else {
        crate::autostart::disable_autostart()
    }
}

/// Queries the Windows Task Scheduler to check if auto-start is registered.
#[tauri::command]
fn get_autostart_status() -> bool {
    crate::autostart::is_autostart_enabled()
}

// ─── Feature 3: Dynamic Remote Presets Commands ─────────────────────────────

/// Manually triggers a remote preset refresh.
/// Frontend can call this via a "Sync Now" button.
/// Emits `remote_presets_updated` or `remote_presets_offline` events.
#[tauri::command]
async fn refresh_remote_presets(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    use crate::presets::{fetch_remote_presets, save_cached_presets, RemoteFetchOutcome};

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let cached_version = crate::presets::load_cached_presets(&app_data)
        .map(|m| m.version);

    match fetch_remote_presets(&state.http_client, cached_version.as_deref()).await {
        RemoteFetchOutcome::Updated(manifest) => {
            let version = manifest.version.clone();
            save_cached_presets(&manifest, &app_data).ok();

            // Update the in-memory loader
            lock_or_err!(state.config_loader)
                .map_err(|e| e.to_string())?
                .load_remote_presets(manifest.presets);

            let _ = app.emit("remote_presets_updated", &version);
            Ok(version)
        }
        RemoteFetchOutcome::VersionUnchanged => Ok("unchanged".into()),
        RemoteFetchOutcome::Offline => {
            let _ = app.emit("remote_presets_offline", ());
            Err("Offline: Remote presets are unreachable.".into())
        }
        RemoteFetchOutcome::ParseError(e) => Err(format!("Parse error: {}", e)),
        RemoteFetchOutcome::SignatureInvalid => Err("CRITICAL: Security Signature invalid! (CVE-5 Protection)".into()),
    }
}

// ─── Feature 8: DoH Forwarder Commands ──────────────────────────────────────

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForwarderStatus {
    pub active: bool,
    pub port: u16,
    pub endpoint: String,
}

/* 
   Starts the local DoH forwarding UDP listener on port 5353.
   Requires that no other process is already using port 5353. 
*/
#[tauri::command]
async fn start_doh_forwarder(
    state: State<'_, AppState>,
) -> Result<ForwarderStatus, String> {
    // First check (fast path: avoid unnecessary async spawn).
    {
        let guard = state.forwarder.lock()
            .map_err(|_| "Forwarder lock poisoned.".to_string())?;
        if guard.is_some() {
            return Err("DoH Forwarder is already running.".into());
        }
    }
    // Note: lock released before spawn — a concurrent call can pass this check too.
    // The definitive guard is the single-scope check-and-assign block below.

    let handle = spawn_doh_forwarder(
        state.http_client.clone(),
        DOH_FORWARDER_DEFAULT_PORT,
        DoHEndpoint::Cloudflare,
    ).await?;

    // Definitive check-and-assign in a single lock scope to prevent double-start.
    let status = {
        let mut guard = state.forwarder.lock()
            .map_err(|_| "Forwarder lock poisoned.".to_string())?;

        if guard.is_some() {
            // Race condition: another concurrent call won — stop the handle we just spawned.
            tauri::async_runtime::spawn(async move { handle.stop().await; });
            return Err("DoH Forwarder is already running.".into());
        }

        let port = handle.port;
        let endpoint = handle.endpoint.url().to_string();
        *guard = Some(handle);

        ForwarderStatus { active: true, port, endpoint }
    };

    tracing::info!("DoH Forwarder started: port {}", DOH_FORWARDER_DEFAULT_PORT);
    Ok(status)
}

/// Stops the DoH forwarder if running.
#[tauri::command]
async fn stop_doh_forwarder(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let handle = {
        let mut guard = state.forwarder.lock()
            .map_err(|_| "Forwarder lock poisoned.".to_string())?;
        guard.take()
    };

    if let Some(h) = handle {
        h.stop().await;
        Ok(())
    } else {
        Err("DoH Forwarder is already stopped.".into())
    }
}

// Returns current DoH forwarder status.
#[tauri::command]
fn get_doh_forwarder_status(state: State<'_, AppState>) -> ForwarderStatus {
    let guard = state.forwarder.lock().unwrap_or_else(|e| e.into_inner());
    match guard.as_ref() {
        Some(h) => ForwarderStatus {
            active: true,
            port: h.port,
            endpoint: h.endpoint.url().to_string(),
        },
        None => ForwarderStatus {
            active: false,
            port: DOH_FORWARDER_DEFAULT_PORT,
            endpoint: DoHEndpoint::Cloudflare.url().to_string(),
        },
    }
}

/* 
   Measures true network latency via a single ICMP ping to 1.1.1.1 on Windows.
   Spawns `ping -n 1 -w 3000 1.1.1.1` and parses the avg ms from stdout.
   Falls back to None if the command fails or output cannot be parsed.
*/
#[cfg(target_os = "windows")]
fn icmp_ping_ms() -> Option<u64> {
    let output = std::process::Command::new("ping")
        .args(["-n", "1", "-w", "3000", "1.1.1.1"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    
    // Example line: "    Minimum = 10ms, Maximum = 10ms, Average = 10ms"
    // Also handles: "Ortalama = 10ms" for Turkish locales
    for line in stdout.lines() {
        let lower = line.to_lowercase();
        if lower.contains("average") || lower.contains("ortalama") {
            let parts: Vec<&str> = line.split('=').collect();
            if let Some(last) = parts.last() {
                let digits: String = last.chars().filter(|c| c.is_ascii_digit()).collect();
                if let Ok(ms) = digits.parse::<u64>() {
                    return Some(ms);
                }
            }
        }
    }
    None
}

// ─── Feature 9: Engine Health Check Command ──────────────────────────────────

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthStatus {
    pub healthy: bool,
    pub latency_ms: u64,
    pub checked_at: String,
    pub target: String,
}

/* 
   Performs a quick connectivity check while the engine is running.
   Called by the frontend on a 60s interval when `EngineStatus::Running`.
   Non-blocking — uses the shared HTTP client to HEAD the target URL. 
*/
#[tauri::command]
async fn get_engine_health(
    targets: Option<Vec<String>>,
    state: State<'_, AppState>,
) -> Result<HealthStatus, String> {
    let mut actual_targets = targets.unwrap_or_default();
    if actual_targets.is_empty() {
        actual_targets.push("discord.com".to_string());
    }

    // Step 1: Verify DPI bypass is working via HTTP reachability check.
    let mut all_healthy = true;
    for target in &actual_targets {
        let url = if target.starts_with("http") {
            target.to_string()
        } else {
            format!("https://{}", target)
        };

        let result = state.http_client
            .head(&url)
            .timeout(Duration::from_secs(5))
            .send()
            .await;

        if !matches!(result, Ok(ref resp) if resp.status().as_u16() < 400) {
            all_healthy = false;
            break;
        }
    }

    // Step 2: If healthy, report true ICMP system latency (not HTTP overhead).
    // This gives users an honest "my ping" reading rather than a DPI-inflated HTTP RTT.
    #[cfg(target_os = "windows")]
    let latency_ms: u64 = if all_healthy { icmp_ping_ms().unwrap_or(0) } else { 0 };
    #[cfg(not(target_os = "windows"))]
    let latency_ms: u64 = 0;

    let now = {
        use std::time::{SystemTime, UNIX_EPOCH};
        let secs = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let h = (secs % 86400) / 3600;
        let m = (secs % 3600) / 60;
        let s = secs % 60;
        format!("{:02}:{:02}:{:02} UTC", h, m, s)
    };

    let display_target = if actual_targets.len() == 1 {
        actual_targets[0].clone()
    } else {
        format!("{} Sites", actual_targets.len())
    };

    Ok(HealthStatus {
        healthy: all_healthy,
        latency_ms,
        checked_at: now,
        target: display_target,
    })
}

/* 
   Resolves a domain via both Cloudflare DoH and Google DoH.
   Returns comparison results for use in the TestView diagnostics panel. 
*/
#[tauri::command]
async fn resolve_via_doh(
    domain: String,
    state: State<'_, AppState>,
) -> Result<Vec<DohResult>, ()> {
    let cloudflare = resolve_doh(&state.http_client, DOH_CLOUDFLARE, &domain).await;
    let google = resolve_doh(&state.http_client, DOH_GOOGLE, &domain).await;
    Ok(vec![cloudflare, google])
}

/* 
   Cleans up dangling winws instances from previous sessions during initialization.
   Prevents zombie processes if the app previously crashed or was forcefully closed. 
*/
#[cfg(target_os = "windows")]
fn kill_existing_winws() {
    tracing::info!("Startup cleanup: Searching for existing winws process...");
    let result = std::process::Command::new("taskkill")
        .args(["/F", "/IM", "winws-x86_64-pc-windows-msvc.exe"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    match result {
        Ok(out) if out.status.success() => {
            tracing::info!("Zombie winws process terminated.");
        }
        Ok(_) => {
            tracing::debug!("No winws process found to clean up (normal).");
        }
        Err(e) => {
            tracing::warn!("taskkill could not be run: {}", e);
        }
    }
}

#[cfg(target_os = "windows")]
fn cleanup_stale_windivert() {
    tracing::info!("Startup cleanup: Checking for stale WinDivert services...");
    let result = std::process::Command::new("sc")
        .args(["query", "WinDivert"])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output();

    match result {
        Ok(out) if out.status.success() => {
            let output_str = String::from_utf8_lossy(&out.stdout);
            // If it exists but is not running correctly, wiping it forces a clean reinstall.
            if output_str.contains("STOPPED") || output_str.contains("START_PENDING") || output_str.contains("STOP_PENDING") {
                tracing::info!("Stale WinDivert service found. Disposing...");
                let _ = std::process::Command::new("sc")
                    .args(["delete", "WinDivert"])
                    .creation_flags(0x08000000)
                    .output();
            }
        }
        _ => tracing::debug!("No stale WinDivert service found (normal)."),
    }
}

pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        // Multi-instance prevention: second launch focuses the existing window.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            tracing::warn!("Second Vane instance detected — bringing window to front.");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(LevelFilter::Info)
                // Keep only the latest log file to prevent unbounded disk growth.
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
                // 10 MB per log file — sufficient for several days of operation.
                .max_file_size(10 * 1024 * 1024)
                .build(),
        )
        .setup(|app| {
            // Clean up dangling processes from previous runs (Windows only)
            #[cfg(target_os = "windows")]
            kill_existing_winws();
            #[cfg(target_os = "windows")]
            cleanup_stale_windivert();

            // ─── Feature 6B: Event-driven network watcher ─────────────────
/* 
   Replaces the previous 30-second polling loop.
   WM_DEVICECHANGE fires immediately on adapter changes -> zero CPU overhead. 
*/
            let watcher_handle = app.handle().clone();
            if let Err(e) = spawn_network_watcher(watcher_handle) {
                tracing::warn!("Network watcher could not start: {}", e);
            }

            // WinDivert automatically applies its filters to new adapters transparently without needing a restart.
            // Therefore, we just log the event. Frontend DNS/Network UI can listen to `network_changed` directly.
            app.listen("network_changed", |_event| {
                tracing::info!("Network change detected. Frontend UI will be updated.");
            });

            let mut loader = ConfigLoader::new();
            if let Ok(app_data) = app.path().app_data_dir() {
                let presets_path = app_data.join("presets");
                let _ = std::fs::create_dir_all(&presets_path);
                loader.load_custom_presets_from(&presets_path);

                // ─── Feature 3: Cache-First Remote Presets ─────────────────
                // Phase 1: Load from disk immediately (synchronous, zero network I/O).
                if let Some(cached) = crate::presets::load_cached_presets(&app_data) {
                    loader.load_remote_presets(cached.presets);
                }
            }

            let http_client = reqwest::Client::builder()
                .timeout(Duration::from_secs(8))
                .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .pool_max_idle_per_host(2)
                .build()
                .unwrap_or_else(|e| {
                    // TLS init may fail on FIPS-mode Windows or missing root certs.
                    // Fall back to a plain client — functionality degrades gracefully.
                    tracing::warn!("HTTP Client TLS initialization failed, using fallback: {}", e);
                    reqwest::Client::new()
                });

            // Phase 2: Fetch remote presets in background (non-blocking).
            // If offline, the cached presets loaded above remain active.
            if let Ok(app_data) = app.path().app_data_dir() {
                let fetch_client = http_client.clone();
                let fetch_app = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    use crate::presets::{fetch_remote_presets, save_cached_presets, RemoteFetchOutcome};

                    let cached_ver = crate::presets::load_cached_presets(&app_data)
                        .map(|m| m.version);

                    match fetch_remote_presets(&fetch_client, cached_ver.as_deref()).await {
                        RemoteFetchOutcome::Updated(manifest) => {
                            let version = manifest.version.clone();
                            save_cached_presets(&manifest, &app_data).ok();
                            // Notify frontend — it will re-invoke list_presets
                            let _ = fetch_app.emit("remote_presets_updated", version);
                        }
                        RemoteFetchOutcome::Offline => {
                            tracing::warn!("Remote presets: Offline mode — using cache.");
                            let _ = fetch_app.emit("remote_presets_offline", ());
                        }
                        RemoteFetchOutcome::VersionUnchanged => {
                            tracing::debug!("Remote presets: Up to date, no update needed.");
                        }
                        RemoteFetchOutcome::ParseError(e) => {
                            tracing::error!("Remote presets parse error: {}", e);
                        }
                        RemoteFetchOutcome::SignatureInvalid => {
                            tracing::error!("CRITICAL WARNING: Remote presets (Gist) does not have a valid minisign signature!");
                        }
                    }
                });
            }

            // Lock main widget position to the bottom right of the primary screen
            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.set_minimizable(false);
                let _ = main_win.set_maximizable(false);

                if let Ok(Some(monitor)) = main_win.current_monitor() {
                    let screen_size = monitor.size();
                    let scale = monitor.scale_factor();
                    let w = (320.0 * scale) as u32;
                    let h = (260.0 * scale) as u32;
                    let margin_x = (24.0 * scale) as u32;
                    let margin_y = (60.0 * scale) as u32;
                    let pos = tauri::PhysicalPosition::new(
                        screen_size.width.saturating_sub(w).saturating_sub(margin_x),
                        screen_size.height.saturating_sub(h).saturating_sub(margin_y),
                    );
                    let _ = main_win.set_position(pos);
                }

                let args: Vec<String> = std::env::args().collect();
                let is_autostart = args.iter().any(|arg| arg == "--autostart" || arg == "--minimized");
                
                if !is_autostart {
                    let _ = main_win.show();
                    let _ = main_win.set_focus();
                }
            }

            // System Tray setup
            if let Some(icon) = app.default_window_icon().cloned() {
                use tauri::menu::{MenuBuilder, MenuItem, PredefinedMenuItem, IconMenuItem};
                
                let header_item = IconMenuItem::with_id(app, "header", "Vane", false, Some(icon.clone()), None::<&str>)?;
                let show_item = MenuItem::with_id(app, "show", "Show / Hide", true, None::<&str>)?;
                let update_item = MenuItem::with_id(app, "update", "Check for Updates...", true, None::<&str>)?;
                let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
                let quit_item = MenuItem::with_id(app, "quit", "Quit Vane", true, None::<&str>)?;

                let menu = MenuBuilder::new(app)
                    .items(&[
                        &header_item,
                        &PredefinedMenuItem::separator(app)?,
                        &show_item,
                        &update_item,
                        &settings_item,
                        &PredefinedMenuItem::separator(app)?,
                        &quit_item
                    ])
                    .build()?;

                let _tray = tauri::tray::TrayIconBuilder::new()
                    .icon(icon)
                    .tooltip("Vane")
                    .menu(&menu)
                    .on_menu_event(|app, event| {
                        match event.id().as_ref() {
                            "quit" => {
                                tracing::info!("Exit requested from tray menu.");
                                if let Some(state) = app.try_state::<AppState>() {
                                    if let Some(main_win) = app.get_webview_window("main") {
                                        let _ = state.engine_manager.stop(main_win.app_handle());
                                    }
                                }
                                app.exit(0);
                            }
                            "show" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let is_visible = window.is_visible().unwrap_or(false);
                                    if is_visible {
                                        let _ = window.hide();
                                    } else {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                            }
                            "update" => {
                                tracing::info!("Update check requested from tray menu.");
                                let app_handle = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    let _ = check_for_updates(app_handle).await;
                                });
                            }
                            "settings" => {
                                tracing::info!("Settings requested from tray menu.");
                                let app_handle = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    let _ = open_settings_window(app_handle).await;
                                });
                            }
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            button_state: tauri::tray::MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app_handle = tray.app_handle();
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let is_visible = window.is_visible().unwrap_or(false);
                                if is_visible {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    })
                    .build(app)?;
            }

            // Global singleton HTTP client for pooled request reusing
            app.manage(AppState {
                engine_manager: EngineManager::new(),
                config_loader: Mutex::new(loader),
                http_client,
                forwarder: Mutex::new(None),
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    if window.label() == "main" {
                        // Keep engine running in background when main window is closed
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
                tauri::WindowEvent::Destroyed => {
                    if window.label() == "main" {
                        if let Some(state) = window.try_state::<AppState>() {
                            tracing::info!("Main window is being destroyed, engine is stopping.");
                            let _ = state.engine_manager.stop(window.app_handle());
                        }
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            start_engine,
            stop_engine,
            get_engine_status,
            list_presets,
            save_custom_preset,
            delete_custom_preset,
            check_url_health,
            check_dns_block,
            start_auto_optimize,
            get_last_optimized_preset,
            list_dns_providers,
            get_network_adapters,
            apply_dns_settings,
            reset_dns_settings,
            check_trusted_dns,
            start_engine_with_dns_guard,
            open_settings_window,
            get_system_info,
            // Feature 2: Auto-Start
            check_is_elevated,
            set_autostart,
            get_autostart_status,
            // Feature 3: Dynamic Remote Presets
            refresh_remote_presets,
            // Feature 4: Updater
            check_for_updates,
            install_update,
            // Feature 6A: DoH
            resolve_via_doh,
            // Feature 8: DoH Forwarder
            start_doh_forwarder,
            stop_doh_forwarder,
            get_doh_forwarder_status,
            // Feature 9: Health Check
            get_engine_health,
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("Tauri could not be started");

    app.run(|app_handle: &AppHandle, event: tauri::RunEvent| {
        if let tauri::RunEvent::Exit = event {
            tracing::info!("Tauri application closing (RunEvent::Exit). Stopping engine...");
            if let Some(state) = app_handle.try_state::<AppState>() {
                let _ = state.engine_manager.stop(app_handle);
            }
        }
    });
}