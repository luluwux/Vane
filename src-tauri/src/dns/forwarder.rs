/* 
   Local DNS-over-HTTPS Forwarder
   Listens on a local UDP port (default: 5300) and proxies all incoming
   standard DNS queries to a DoH endpoint (Cloudflare or Google) via HTTPS.
   This makes the *entire* machine use encrypted DNS — not just Vane itself —
   without modifying the Windows DNS Client service or touching port 53.
   Usage flow:
   1. Call `spawn_doh_forwarder(app, port)` → returns a `ForwarderHandle`
   2. Configure the active network adapter's DNS to `127.0.0.1` with
      custom port routing (or use port 5300 directly via client config)
   3. Call `stop_doh_forwarder(handle)` to shut down gracefully 
*/

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::net::UdpSocket;

use trust_dns_proto::{
    op::Message,
    serialize::binary::BinDecodable,
};

pub const DOH_FORWARDER_DEFAULT_PORT: u16 = 5300;

// Endpoint options for the DoH upstream resolver.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DoHEndpoint {
    Cloudflare,
    Google,
}

impl DoHEndpoint {
    pub fn url(&self) -> &'static str {
        match self {
            Self::Cloudflare => "https://cloudflare-dns.com/dns-query",
            Self::Google => "https://dns.google/dns-query",
        }
    }
}

/* 
   Handle returned by `spawn_doh_forwarder`.
   Dropping this handle does NOT stop the forwarder — call `stop_doh_forwarder`. 
*/
pub struct ForwarderHandle {
    pub port: u16,
    pub endpoint: DoHEndpoint,
    // Signal to request graceful shutdown of the listener loop.
    shutdown: Arc<AtomicBool>,
    task: tokio::task::JoinHandle<()>,
}

impl ForwarderHandle {
    // Signals the forwarder to stop and waits for the task to complete.
    pub async fn stop(self) {
        self.shutdown.store(true, Ordering::SeqCst);
        // Abort is safe here — the task holds no exclusive resources.
        self.task.abort();
        let _ = self.task.await;
        tracing::info!("DoH Forwarder durduruldu (port {}).", self.port);
    }
}

/* 
   Spawns the local DoH forwarding UDP listener on `port`.
   Errors: Returns `Err` if the socket cannot be bound (port in use, insufficient privilege). 
*/
pub async fn spawn_doh_forwarder(
    client: reqwest::Client,
    port: u16,
    endpoint: DoHEndpoint,
) -> Result<ForwarderHandle, String> {
    let addr = format!("127.0.0.1:{}", port);
    let socket = UdpSocket::bind(&addr)
        .await
        .map_err(|e| format!("DoH Forwarder port {} bağlanamadı: {}", port, e))?;

    tracing::info!(
        "DoH Forwarder başlatıldı: {} → {}",
        addr,
        endpoint.url()
    );

    let socket = Arc::new(socket);
    let shutdown = Arc::new(AtomicBool::new(false));
    let shutdown_clone = Arc::clone(&shutdown);
    let endpoint_url = endpoint.url();

    let task = tokio::spawn(async move {
        run_forwarder_loop(socket, client, endpoint_url, shutdown_clone).await;
    });

    Ok(ForwarderHandle { port, endpoint, shutdown, task })
}

// Core UDP→DoH proxy loop.
async fn run_forwarder_loop(
    socket: Arc<UdpSocket>,
    client: reqwest::Client,
    endpoint_url: &'static str,
    shutdown: Arc<AtomicBool>,
) {
    let mut buf = vec![0u8; 512]; // Standard DNS UDP max payload
    const MAX_CONCURRENT_DNS_REQUESTS: usize = 100;
    let semaphore = Arc::new(tokio::sync::Semaphore::new(MAX_CONCURRENT_DNS_REQUESTS));

    loop {
        if shutdown.load(Ordering::SeqCst) {
            break;
        }

        // Non-blocking receive with 1s timeout to allow shutdown checks.
        let recv_result = tokio::time::timeout(
            std::time::Duration::from_secs(1),
            socket.recv_from(&mut buf),
        ).await;

        let (len, client_addr) = match recv_result {
            Ok(Ok(r)) => r,
            Ok(Err(e)) => {
                tracing::warn!("DoH Forwarder recv hatası: {}", e);
                continue;
            }
            Err(_) => continue, // timeout — loop back for shutdown check
        };

        let query_bytes = bytes::Bytes::copy_from_slice(&buf[..len]);
        let socket_clone = Arc::clone(&socket);
        let client_clone = client.clone();
        let semaphore_clone = Arc::clone(&semaphore);

        let Ok(permit) = semaphore_clone.try_acquire_owned() else {
            tracing::warn!("DoH forwarder: concurrency limit reached, dropping query from {}", client_addr);
            continue;
        };

        // Handle each DNS query concurrently — multiple clients can query simultaneously.
        tokio::spawn(async move {
            let _permit = permit; // RAII: drop at end of request
            if let Some(response) = proxy_dns_query(&client_clone, endpoint_url, query_bytes).await {
                if let Err(e) = socket_clone.send_to(&response, client_addr).await {
                    tracing::warn!("DoH Forwarder send hatası → {}: {}", client_addr, e);
                }
            }
        });
    }
}

/* 
   Proxies a single DNS wire-format query to the DoH endpoint.
   Returns the DNS wire-format response, or `None` on any error. 
*/
async fn proxy_dns_query(
    client: &reqwest::Client,
    endpoint_url: &str,
    query_bytes: bytes::Bytes,
) -> Option<bytes::Bytes> {
    // Validate incoming bytes early — prevents forwarding garbage to DoH.
    let _parsed = Message::from_bytes(&query_bytes)
        .map_err(|e| tracing::warn!("Geçersiz DNS sorgusu alındı: {}", e))
        .ok()?;

    // RFC 8484: POST with application/dns-message
    let response = client
        .post(endpoint_url)
        .header("Content-Type", "application/dns-message")
        .header("Accept", "application/dns-message")
        .body(query_bytes)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| tracing::warn!("DoH upstream hatası: {}", e))
        .ok()?;

    if !response.status().is_success() {
        tracing::warn!("DoH upstream HTTP {}", response.status());
        return None;
    }

    let response_bytes = response.bytes().await
        .map_err(|e| tracing::warn!("DoH yanıt okuma hatası: {}", e))
        .ok()?;

    // Validate response before sending to client.
    let _reply = Message::from_bytes(&response_bytes)
        .map_err(|e| tracing::warn!("DoH yanıtı parse edilemedi: {}", e))
        .ok()?;

    Some(response_bytes)
}
