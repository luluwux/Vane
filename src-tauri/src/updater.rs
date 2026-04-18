use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

/// Simplified update info returned to the frontend.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub body: Option<String>,
    pub download_url: String,
}

/// Checks for a new application update from the configured endpoint.
///
/// Returns `None` if the app is already up to date.
/// Returns `Some(UpdateInfo)` if a newer version is available.
#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    let updater = app
        .updater()
        .map_err(|e| format!("Failed to initialize updater: {}", e))?;

    match updater.check().await {
        Ok(Some(update)) => {
            tracing::info!("New version available: {}", update.version);
            Ok(Some(UpdateInfo {
                version: update.version.clone(),
                body: update.body.clone(),
                download_url: update.download_url.to_string(),
            }))
        }
        Ok(None) => {
            tracing::debug!("Application is up to date.");
            Ok(None)
        }
        Err(e) => {
            // Non-fatal: update check failure should not break the app.
            tracing::warn!("Update check failed: {}", e);
            Err(format!("Update check failed: {}", e))
        }
    }
}

/// Downloads and installs the available update, then restarts the application.
///
/// Should only be called after `check_for_updates` returned `Some(...)`.
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    let updater = app
        .updater()
        .map_err(|e| format!("Failed to initialize updater: {}", e))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("Failed to get update: {}", e))?
        .ok_or_else(|| "No update found.".to_string())?;

    tracing::info!("Downloading update: v{}", update.version);

    update
        .download_and_install(|_chunk_len, _content_len| {}, || {})
        .await
        .map_err(|e| format!("Failed to install update: {}", e))?;

    tracing::info!("Update installed, restarting application...");
    app.restart();
}
