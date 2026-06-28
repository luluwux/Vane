use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::Emitter;

pub fn spawn_dns_watchdog(
    client: reqwest::Client,
    endpoint_url: String,
    shutdown: Arc<AtomicBool>,
    app_handle: tauri::AppHandle,
) {
    tokio::spawn(async move {
        let mut fail_count = 0;
        tracing::info!("DNS watchdog task started.");

        loop {
            if shutdown.load(Ordering::SeqCst) {
                break;
            }

            tokio::time::sleep(Duration::from_secs(5)).await;

            if shutdown.load(Ordering::SeqCst) {
                break;
            }

            // Perform connection check to DoH endpoint
            let check_result = client.head(&endpoint_url)
                .timeout(Duration::from_secs(3))
                .send()
                .await;

            match check_result {
                Ok(resp) if resp.status().is_success() => {
                    fail_count = 0;
                }
                _ => {
                    fail_count += 1;
                    tracing::warn!("DNS watchdog: DoH endpoint unreachable (fail count: {}/3)", fail_count);
                }
            }

            if fail_count >= 3 {
                tracing::error!("CRITICAL: DoH resolver is unreachable for 15s. Reverting system DNS to DHCP!");
                
                // Revert system DNS to DHCP
                let res = crate::dns::reset_dns_to_dhcp();
                if res.success {
                    tracing::info!("System DNS reverted to DHCP successfully.");
                    let _ = app_handle.emit("dns_status_changed", ());
                    let _ = app_handle.emit("dns_auto_applied", "DoH bağlantısı koptu. İnternet erişimini kurtarmak için sistem DNS'i otomatik olarak DHCP'ye sıfırlandı.");
                } else {
                    tracing::error!("Failed to revert system DNS to DHCP: {:?}", res.error);
                }
                
                // Exit watchdog since we reverted
                break;
            }
        }
        tracing::info!("DNS watchdog task stopped.");
    });
}
