use serde::{Deserialize, Serialize};
use std::path::Path;
use crate::config::preset::Preset;
use minisign_verify::{PublicKey, Signature};

/// The remote URL serving the dynamic presets manifest.
pub const REMOTE_PRESETS_URL: &str =
    "https://gist.githubusercontent.com/YOUR_USERNAME/YOUR_GIST_ID/raw/presets.json";

/// The signature URL (Minisign ed25519 signature of the presets.json file)
pub const REMOTE_PRESETS_SIG_URL: &str =
    "https://gist.githubusercontent.com/YOUR_USERNAME/YOUR_GIST_ID/raw/presets.json.sig";

/// Embedded Minisign public key for verifying the remote JSON.
/// In production, generate securely and replace this.
pub const MANIFEST_PUBLIC_KEY: &str = "RWQYOUR_MINISIGN_PUBLIC_KEY_HERE";

/// The manifest fetched from the remote endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemotePresetsManifest {
    /// Semantic version string. Used to diff against cached version.
    pub version: String,
    /// ISO date string for display purposes (e.g. "2026-04-18").
    pub updated_at: String,
    pub presets: Vec<Preset>,
}

/// Categorizes the outcome of a remote fetch attempt.
#[derive(Debug)]
pub enum RemoteFetchOutcome {
    /// New presets downloaded and cached.
    Updated(RemotePresetsManifest),
    /// Remote version matches cache — no write needed.
    VersionUnchanged,
    /// Network is unreachable — caller should surface "offline" badge.
    Offline,
    /// Response received but JSON parsing failed.
    ParseError(String),
    /// Signature verification failed. Potential compromise or tampering.
    SignatureInvalid,
}

/// Fetches the remote presets manifest with a strict timeout.
///
/// Returns `RemoteFetchOutcome::Offline` for any network error,
/// so callers can always fall back to the local cache without panicking.
pub async fn fetch_remote_presets(
    client: &reqwest::Client,
    cached_version: Option<&str>,
) -> RemoteFetchOutcome {
    let response = match client
        .get(REMOTE_PRESETS_URL)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("Remote presets fetch failed (offline?): {}", e);
            return RemoteFetchOutcome::Offline;
        }
    };

    let text = match response.text().await {
        Ok(t) => t,
        Err(e) => {
            tracing::warn!("Failed to read remote presets response: {}", e);
            return RemoteFetchOutcome::Offline;
        }
    };

    // ─── CVE-5: Minisign ED25519 Verification ───
    let sig_response = match client
        .get(REMOTE_PRESETS_SIG_URL)
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("Signature fetch failed (Network or file missing): {}", e);
            return RemoteFetchOutcome::SignatureInvalid;
        }
    };

    let sig_text = match sig_response.text().await {
        Ok(t) => t,
        Err(_) => return RemoteFetchOutcome::SignatureInvalid,
    };

    let pub_key = match PublicKey::from_base64(MANIFEST_PUBLIC_KEY) {
        Ok(k) => k,
        Err(e) => {
            tracing::error!("Embedded public key is invalid: {}", e);
            return RemoteFetchOutcome::SignatureInvalid;
        }
    };

    let signature = match Signature::decode(&sig_text) {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("Signature file (sig) could not be parsed: {}", e);
            return RemoteFetchOutcome::SignatureInvalid;
        }
    };

    if let Err(e) = pub_key.verify(text.as_bytes(), &signature, false) {
        tracing::error!("CRITICAL WARNING (CVE-5): Gist JSON signature verification failed! Tampering detected: {}", e);
        return RemoteFetchOutcome::SignatureInvalid;
    }
    // ────────────────────────────────────────────

    let manifest: RemotePresetsManifest = match serde_json::from_str(&text) {
        Ok(m) => m,
        Err(e) => {
            tracing::error!("Remote presets JSON parse error: {}", e);
            return RemoteFetchOutcome::ParseError(e.to_string());
        }
    };

    // Skip disk write if the version hasn't changed — reduces I/O churn.
    if let Some(cached) = cached_version {
        if cached == manifest.version {
            tracing::debug!("Remote presets are up to date (v{}), cache is valid.", manifest.version);
            return RemoteFetchOutcome::VersionUnchanged;
        }
    }

    tracing::info!(
        "Remote presets updated: v{} ({})",
        manifest.version,
        manifest.updated_at
    );
    RemoteFetchOutcome::Updated(manifest)
}

/// Loads the cached preset manifest from disk.
///
/// Returns `None` if the cache file doesn't exist or is corrupted.
/// Corruption results in a warning log — not a hard failure.
pub fn load_cached_presets(app_data: &Path) -> Option<RemotePresetsManifest> {
    let cache_path = app_data.join("remote_presets_cache.json");

    let content = std::fs::read_to_string(&cache_path).ok()?;

    match serde_json::from_str::<RemotePresetsManifest>(&content) {
        Ok(manifest) => {
            tracing::info!(
                "Remote presets loaded from cache: v{} ({} presets)",
                manifest.version,
                manifest.presets.len()
            );
            Some(manifest)
        }
        Err(e) => {
            tracing::warn!("Remote presets cache is corrupted, skipping: {}", e);
            None
        }
    }
}

/// Atomically writes the manifest to the cache file.
///
/// Uses a temp file + rename pattern to prevent partial writes from
/// leaving the cache in a corrupted state on power loss or crash.
pub fn save_cached_presets(manifest: &RemotePresetsManifest, app_data: &Path) -> Result<(), String> {
    let cache_path = app_data.join("remote_presets_cache.json");
    let temp_path = app_data.join("remote_presets_cache.tmp");

    let content = serde_json::to_string_pretty(manifest)
        .map_err(|e| format!("Serialization error: {}", e))?;

    std::fs::write(&temp_path, &content)
        .map_err(|e| format!("Could not write temp file: {}", e))?;

    // Atomic rename — on Windows this replaces the destination atomically.
    std::fs::rename(&temp_path, &cache_path)
        .map_err(|e| format!("Cache rename error: {}", e))?;

    tracing::debug!("Remote presets cache updated: {:?}", cache_path);
    Ok(())
}
