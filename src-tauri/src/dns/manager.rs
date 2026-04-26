use serde::{Deserialize, Serialize};
use std::process::Command;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Constant for CREATE_NO_WINDOW flag on Windows to prevent console window flashing.
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Known trusted DNS providers
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsProvider {
    pub id: String,
    pub name: String,
    pub primary: String,
    pub secondary: String,
    pub emoji: String,
    pub description: String,
}

/// Windows network adapter
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkAdapter {
    pub name: String,
    pub current_primary_dns: Option<String>,
    pub current_secondary_dns: Option<String>,
    pub is_dhcp: bool,
}

/// DNS modification result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyDnsResult {
    pub success: bool,
    pub applied_adapters: Vec<String>,
    pub error: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum DnsError {
    #[error("Komut çalıştırılamadı: {0}")]
    CommandFailed(String),
    #[error("Adaptör bulunamadı")]
    NoAdapterFound,
    #[error("Yetki hatası")]
    PermissionDenied,
}

pub fn builtin_providers() -> Vec<DnsProvider> {
    vec![
        DnsProvider {
            id: "cloudflare".into(),
            name: "Cloudflare".into(),
            primary: "1.1.1.1".into(),
            secondary: "1.0.0.1".into(),
            emoji: "🌩️".into(),
            description: "Speed & Privacy - Fastest DNS".into(),
        },
        DnsProvider {
            id: "google".into(),
            name: "Google".into(),
            primary: "8.8.8.8".into(),
            secondary: "8.8.4.4".into(),
            emoji: "🔵".into(),
            description: "Reliable & Stable".into(),
        },
        DnsProvider {
            id: "quad9".into(),
            name: "Quad9".into(),
            primary: "9.9.9.9".into(),
            secondary: "149.112.112.112".into(),
            emoji: "9️⃣".into(),
            description: "Security Focused - Blocks Malware".into(),
        },
        DnsProvider {
            id: "opendns".into(),
            name: "OpenDNS".into(),
            primary: "208.67.222.222".into(),
            secondary: "208.67.220.220".into(),
            emoji: "☁️".into(),
            description: "Filtering & Security".into(),
        },
        DnsProvider {
            id: "adguard".into(),
            name: "AdGuard".into(),
            primary: "94.140.14.14".into(),
            secondary: "94.140.15.15".into(),
            emoji: "🛡️".into(),
            description: "Blocks Ads & Trackers".into(),
        },
        DnsProvider {
            id: "nextdns".into(),
            name: "NextDNS".into(),
            primary: "45.90.28.167".into(),
            secondary: "45.90.30.167".into(),
            emoji: "⏩".into(),
            description: "Block Ads & Trackers".into(),
        },
        DnsProvider {
            id: "yandex".into(),
            name: "Yandex".into(),
            primary: "77.88.8.8".into(),
            secondary: "77.88.8.1".into(),
            emoji: "🔴".into(),
            description: "Fast & Reliable".into(),
        },
        DnsProvider {
            id: "mullvad".into(),
            name: "Mullvad".into(),
            primary: "194.242.2.4".into(),
            secondary: "194.242.2.5".into(),
            emoji: "🔐".into(),
            description: "Privacy First (No Logging)".into(),
        },
    ]
}

/// Reads active network adapters and current DNS settings on the system.
/// Parses the output of `netsh interface ip show config`.
#[cfg(target_os = "windows")]
pub fn get_active_adapters() -> Vec<NetworkAdapter> {
    let output = Command::new("netsh")
        .args(["interface", "ip", "show", "config"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    let Ok(out) = output else {
        return vec![];
    };

    let text = String::from_utf8_lossy(&out.stdout);
    parse_netsh_config(&text)
}

#[cfg(not(target_os = "windows"))]
pub fn get_active_adapters() -> Vec<NetworkAdapter> {
    vec![]
}

fn parse_netsh_config(text: &str) -> Vec<NetworkAdapter> {
    let mut adapters: Vec<NetworkAdapter> = vec![];
    let mut current_name: Option<String> = None;
    let mut primary: Option<String> = None;
    let mut secondary: Option<String> = None;
    let mut is_dhcp = true;

    for line in text.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("Configuration for interface") {
            // Save the previous adapter
            if let Some(name) = current_name.take() {
                adapters.push(NetworkAdapter {
                    name,
                    current_primary_dns: primary.take(),
                    current_secondary_dns: secondary.take(),
                    is_dhcp,
                });
            }
            // Parse new adapter name: `Configuration for interface "Ethernet"`
            if let Some(start) = trimmed.find('"') {
                if let Some(end) = trimmed.rfind('"') {
                    if start < end {
                        current_name = Some(trimmed[start + 1..end].to_string());
                        is_dhcp = true;
                        primary = None;
                        secondary = None;
                    }
                }
            }
        } else if trimmed.starts_with("Statically Configured DNS Servers:") {
            is_dhcp = false;
            let dns = trimmed.split(':').nth(1).map(|s| s.trim().to_string());
            if let Some(d) = dns {
                if !d.is_empty() && d != "None" {
                    primary = Some(d);
                }
            }
        } else if trimmed.starts_with("Register with which suffix:") {
            // Secondary DNS line is usually before this — noop
        } else if primary.is_some() && secondary.is_none() && !is_dhcp {
            // Next numeric line is for secondary DNS
            let candidate = trimmed.to_string();
            if candidate.chars().next().is_some_and(|c| c.is_ascii_digit()) {
                secondary = Some(candidate);
            }
        }
    }

    // Save the last adapter
    if let Some(name) = current_name {
        adapters.push(NetworkAdapter {
            name,
            current_primary_dns: primary,
            current_secondary_dns: secondary,
            is_dhcp,
        });
    }

    // Return only actual physical/virtual adapters (filter out noise like Loopback, vEthernet, Bluetooth, etc.)
    adapters
        .into_iter()
        .filter(|a| {
            !a.name.contains("Loopback")
                && !a.name.contains("vEthernet")
                && !a.name.contains("Bluetooth")
                && !a.name.contains("Teredo")
                && !a.name.contains("isatap")
        })
        .collect()
}

/// Applies the given DNS to all active adapters.
/// netsh interface ip set dns "AdapterName" static 1.1.1.1
#[cfg(target_os = "windows")]
pub fn apply_dns(primary: &str, secondary: &str) -> ApplyDnsResult {
    let adapters = get_active_adapters();

    if adapters.is_empty() {
        return ApplyDnsResult {
            success: false,
            applied_adapters: vec![],
            error: Some("Aktif ağ adaptörü bulunamadı.".into()),
        };
    }

    let mut applied = vec![];
    let mut last_error: Option<String> = None;

    for adapter in &adapters {
        // Primary DNS
        let primary_res = Command::new("netsh")
            .args([
                "interface",
                "ip",
                "set",
                "dns",
                &adapter.name,
                "static",
                primary,
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        let primary_ok = primary_res
            .as_ref()
            .map(|o| o.status.success())
            .unwrap_or(false);

        if primary_ok {
            // Secondary DNS (index=2)
            let _ = Command::new("netsh")
                .args([
                    "interface",
                    "ip",
                    "add",
                    "dns",
                    &adapter.name,
                    secondary,
                    "index=2",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output();

            applied.push(adapter.name.clone());
        } else {
            let err = primary_res
                .map(|o| String::from_utf8_lossy(&o.stderr).to_string())
                .unwrap_or_else(|e| e.to_string());
            last_error = Some(format!("Adaptör '{}' için hata: {}", adapter.name, err));
        }
    }

    ApplyDnsResult {
        success: !applied.is_empty(),
        applied_adapters: applied,
        error: last_error,
    }
}

// DNS management on Linux is handled via resolv.conf / systemd-resolved — stub for now.
#[cfg(not(target_os = "windows"))]
pub fn apply_dns(_primary: &str, _secondary: &str) -> ApplyDnsResult {
    ApplyDnsResult { success: true, applied_adapters: vec![], error: None }
}

/// Reverts DNS back to DHCP (automatic).
#[cfg(target_os = "windows")]
pub fn reset_dns_to_dhcp() -> ApplyDnsResult {
    let adapters = get_active_adapters();
    let mut applied = vec![];

    for adapter in &adapters {
        let res = Command::new("netsh")
            .args([
                "interface",
                "ip",
                "set",
                "dns",
                &adapter.name,
                "dhcp",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        if res.map(|o| o.status.success()).unwrap_or(false) {
            applied.push(adapter.name.clone());
        }
    }

    ApplyDnsResult {
        success: !applied.is_empty(),
        applied_adapters: applied,
        error: None,
    }
}

#[cfg(not(target_os = "windows"))]
pub fn reset_dns_to_dhcp() -> ApplyDnsResult {
    ApplyDnsResult { success: true, applied_adapters: vec![], error: None }
}

/// Checks if the current DNS is a known trusted DNS.
/// Returns `false` if ISP DNS is used.
#[cfg(target_os = "windows")]
pub fn is_using_trusted_dns() -> bool {
    let trusted = [
        "1.1.1.1", "1.0.0.1",       // Cloudflare
        "8.8.8.8", "8.8.4.4",       // Google
        "9.9.9.9", "149.112.112.112", // Quad9
        "208.67.222.222", "208.67.220.220", // OpenDNS
        "94.140.14.14", "94.140.15.15", // AdGuard
    ];

    let adapters = get_active_adapters();
    for adapter in adapters {
        if let Some(primary) = &adapter.current_primary_dns {
            if trusted.contains(&primary.as_str()) {
                return true;
            }
        }
    }
    false
}

// On Linux, assume trusted DNS since management is external (e.g., systemd-resolved).
#[cfg(not(target_os = "windows"))]
pub fn is_using_trusted_dns() -> bool {
    true
}
