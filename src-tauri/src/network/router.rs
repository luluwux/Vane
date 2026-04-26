#[cfg(target_os = "linux")]
use crate::engine::error::EngineError;
#[cfg(target_os = "linux")]
use std::io::{BufRead, BufReader};
#[cfg(target_os = "linux")]
use std::process::{Child, Command, Stdio};

#[cfg(target_os = "linux")]
pub struct NetworkRouteGuard {
    _daemon_process: Child,
}

#[cfg(target_os = "linux")]
impl NetworkRouteGuard {
    pub fn new(queue_num: u16) -> Result<Self, EngineError> {
        let script = format!(
            "iptables -t mangle -I OUTPUT -p tcp -m multiport --dports 80,443 -j NFQUEUE --queue-num {} || exit 1; \
            echo \"READY\"; \
            cat > /dev/null; \
            iptables -t mangle -D OUTPUT -p tcp -m multiport --dports 80,443 -j NFQUEUE --queue-num {}",
            queue_num, queue_num
        );

        let mut child = Command::new("pkexec")
            .arg("sh")
            .arg("-c")
            .arg(&script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| EngineError::SpawnFailed(format!("pkexec başlatılamadı: {}", e)))?;

        let stdout = child.stdout.take().ok_or_else(|| {
            EngineError::IoError("pkexec stdout alınamadı".into())
        })?;

        let mut reader = BufReader::new(stdout);
        let mut line = String::new();

        // Race Condition Koruması: pkexec scriptinden "READY" onayı gelmeden nfqws'i başlatamayız. (Senkron bekleme)
        match reader.read_line(&mut line) {
            Ok(n) if n > 0 && line.trim() == "READY" => {
                tracing::info!("Linux Network Routing aktif (NFQUEUE {})", queue_num);
                // Child objesini sahipleniyoruz. stdin açık kalır, script `cat` satırında bloke olur.
                Ok(Self { _daemon_process: child })
            }
            Ok(n) if n > 0 => {
                let _ = child.kill();
                Err(EngineError::SpawnFailed(format!("iptables beklenmeyen çıktı: {}", line)))
            }
            _ => {
                // pkexec yetki penceresi reddedildiyse veya iptables komutu exit 1 döndüyse
                let status = child.wait().map_err(|e| EngineError::IoError(e.to_string()))?;
                let code = status.code().unwrap_or(-1);
                if code == 126 || code == 127 {
                    Err(EngineError::AuthorizationFailed("Yetki penceresi reddedildi veya yetki alınamadı.".into()))
                } else {
                    Err(EngineError::SpawnFailed(format!("iptables kuralı uygulanamadı (Exit Code: {})", code)))
                }
            }
        }
    }
}

#[cfg(target_os = "linux")]
impl Drop for NetworkRouteGuard {
    fn drop(&mut self) {
        // _daemon_process objesi drop edildiğinde stdin pipe'ı kapanır.
        // Bash script içindeki `cat > /dev/null` komutu EOF (End Of File) alır ve biter.
        // Ardından script son satıra geçer ve iptables kuralını root yetkisiyle güvenle siler.
        tracing::debug!("NetworkRouteGuard drop ediliyor. Temizlik scripti tetiklendi.");
    }
}
