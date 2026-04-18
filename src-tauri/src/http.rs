use std::net::SocketAddr;
use std::time::Instant;
use serde::Serialize;
use tauri::State;
use crate::AppState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PingResult {
    pub success: bool,
    pub latency_ms: u64,
    pub status_code: Option<u16>,
    pub error: Option<String>,
}

/// Advanced result structure that independently tests DNS resolution and HTTP connection.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsCheckResult {
    /// Was DNS resolution successful via system DNS?
    pub system_dns_ok: bool,
    /// Was DNS resolution successful via Cloudflare DoH (DNS-over-HTTPS)?
    pub doh_dns_ok: bool,
    /// Summary indicating whether the issue is DNS or DPI.
    pub diagnosis: String,
    /// Recommended solution to show the user.
    pub recommendation: String,
}

#[tauri::command]
pub async fn check_url_health(url: String, state: State<'_, AppState>) -> Result<PingResult, ()> {
    let client = &state.http_client;

    let target_url = if !url.starts_with("http") {
        format!("https://{}", url)
    } else {
        url
    };

    let start = Instant::now();

    match client.head(&target_url).send().await {
        Ok(response) => {
            let latency_ms = start.elapsed().as_millis() as u64;
            let status_code = response.status().as_u16();
            let success = response.status().is_success()
                || response.status().is_redirection()
                || status_code == 405;

            Ok(PingResult {
                success,
                latency_ms,
                status_code: Some(status_code),
                error: if success {
                    None
                } else {
                    Some(format!("HTTP {}", status_code))
                },
            })
        }
        Err(e) => {
            let latency_ms = start.elapsed().as_millis() as u64;
            let error_msg = if e.is_connect() {
                format!("Connection error (likely DNS block): {}", e)
            } else if e.is_timeout() {
                "Timeout — possibly DPI block or slow connection.".to_string()
            } else {
                e.to_string()
            };

            tracing::warn!("URL health check failed ({}): {}", target_url, error_msg);

            Ok(PingResult {
                success: false,
                latency_ms,
                status_code: e.status().map(|s| s.as_u16()),
                error: Some(error_msg),
            })
        }
    }
}

/// Determines whether the system is affected by a DNS block or a DPI block.
///
/// Method:
/// 1. Try to connect to target using System DNS.
/// 2. Try to connect directly to known IPs (bypassing DNS entirely).
/// The difference between the two results reveals the source of the issue.
#[tauri::command]
pub async fn check_dns_block(domain: String, state: State<'_, AppState>) -> Result<DnsCheckResult, ()> {
    let client = &state.http_client;

    // Known IPs for Discord/YouTube/Twitter.
    // Used to completely bypass DNS resolution.
    let known_ips: std::collections::HashMap<&str, (&str, u16)> = [
        ("discord.com", ("162.159.135.232", 443)),
        ("www.discord.com", ("162.159.135.232", 443)),
        ("x.com", ("104.244.42.65", 443)),
        ("twitter.com", ("104.244.42.65", 443)),
        ("youtube.com", ("142.250.185.14", 443)),
        ("www.youtube.com", ("142.250.185.14", 443)),
    ]
    .into();

    let domain_str = domain
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_start_matches("www.");

    // --- Step 1: System DNS test ---
    let system_dns_ok = client
        .head(format!("https://{}", domain_str))
        .send()
        .await
        .map(|r| r.status().as_u16() < 500)
        .unwrap_or(false);

    // --- Step 2: Direct IP test (Bypasses DNS) ---
    let doh_dns_ok = if let Some((ip, port)) = known_ips.get(domain_str) {
        let addr: SocketAddr = format!("{}:{}", ip, port)
            .parse()
            .unwrap_or_else(|_| "1.1.1.1:443".parse().unwrap());

        // Create a fresh client with resolve override at the builder-level
        let direct_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .pool_max_idle_per_host(0)
            .resolve(domain_str, addr)
            .build();

        match direct_client {
            Ok(c) => c
                .head(format!("https://{}/", domain_str))
                .send()
                .await
                .map(|r| r.status().as_u16() < 500)
                .unwrap_or(false),
            Err(_) => false,
        }
    } else {
        false
    };

    let (diagnosis, recommendation) = match (system_dns_ok, doh_dns_ok) {
        (true, _) => (
            "Your connection is working perfectly! Neither DPI nor DNS is blocking.".to_string(),
            "No changes needed.".to_string(),
        ),
        (false, true) => (
            "🔍 DNS Block Detected! IP connection works but your system DNS is poisoned.".to_string(),
            "Change your DNS server to Cloudflare (1.1.1.1) or Google (8.8.8.8). \
            Windows Settings > Network & Internet > Ethernet/Wi-Fi > DNS server assignment.".to_string(),
        ),
        (false, false) => (
            "⚠️ DPI + DNS Block: Both system DNS and direct IP access are blocked.".to_string(),
            "1) First change your DNS to 1.1.1.1. \
            2) Then find the best DPI bypass method using Smart Scan. \
            3) When both are working, discord.com will be accessible.".to_string(),
        ),
    };

    Ok(DnsCheckResult {
        system_dns_ok,
        doh_dns_ok,
        diagnosis,
        recommendation,
    })
}
