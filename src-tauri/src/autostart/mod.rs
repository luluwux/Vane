use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const TASK_NAME: &str = "Vane";

/// Registers Vane in Windows Task Scheduler to run at logon with highest privileges.
///
/// Using Task Scheduler instead of `HKCU\Run` registry key is deliberate:
/// - `HKCU\Run` cannot request elevated privileges — UAC would prompt on every boot.
/// - Task Scheduler with `/rl highest` silently elevates on logon (no UAC prompt),
///   the same approach used by MSI Afterburner, Rufus, and other professional tools.
///
/// # Requirements
/// The calling process MUST be elevated (admin). Call `is_elevated()` before this function.
pub fn enable_autostart(exe_path: &str) -> Result<(), String> {
    // Wrap path in quotes to handle spaces in Program Files, AppData paths, etc.
    let task_run = format!("\"{}\" --autostart", exe_path);

    let mut cmd = Command::new("schtasks");
    cmd.args([
        "/create",
        "/tn", TASK_NAME,
        "/tr", &task_run,
        "/sc", "onlogon",
        "/rl", "highest",
        "/f",         // Force overwrite if task already exists
    ]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let status = cmd.status()
        .map_err(|e| format!("schtasks çalıştırılamadı: {}", e))?;

    if status.success() {
        tracing::info!("Auto-start görevi oluşturuldu: \"{}\"", TASK_NAME);
        Ok(())
    } else {
        Err(format!(
            "schtasks /create başarısız (exit: {:?}). Yönetici yetkisi gereklidir.",
            status.code()
        ))
    }
}


/// Removes the Vane scheduled task from Task Scheduler.
///
/// Also called by the NSIS uninstaller hook to ensure clean removal.
pub fn disable_autostart() -> Result<(), String> {
    let mut cmd = Command::new("schtasks");
    cmd.args(["/delete", "/tn", TASK_NAME, "/f"]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let status = cmd.status()
        .map_err(|e| format!("schtasks çalıştırılamadı: {}", e))?;

    // Exit code 1 means the task was not found — treat as success (idempotent).
    if status.success() || status.code() == Some(1) {
        tracing::info!("Auto-start görevi silindi: \"{}\"", TASK_NAME);
        Ok(())
    } else {
        Err(format!(
            "schtasks /delete başarısız (exit: {:?})",
            status.code()
        ))
    }
}


/// Returns `true` if the Vane scheduled task exists and is enabled.
pub fn is_autostart_enabled() -> bool {
    let mut cmd = Command::new("schtasks");
    cmd.args(["/query", "/tn", TASK_NAME]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let result = cmd.output();

    match result {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

