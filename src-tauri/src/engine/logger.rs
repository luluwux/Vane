use crate::engine::manager::EngineEventDispatcher;
use tokio::io::{AsyncBufReadExt, BufReader};

pub fn spawn_log_reader<R, D>(stream: R, dispatcher: D, prefix: Option<&'static str>)
where
    R: tokio::io::AsyncRead + Unpin + Send + 'static,
    D: EngineEventDispatcher + 'static,
{
    tauri::async_runtime::spawn(async move {
        let mut reader = BufReader::new(stream).lines();
        let mut batch = Vec::new();
        let mut last_flush = std::time::Instant::now();
        let flush_interval = std::time::Duration::from_millis(200);

        while let Ok(Some(line)) = reader.next_line().await {
            // Limit to 1024 chars to prevent memory exhaustion from infinite lines
            let line: String = line.chars().take(1024).collect();

            if let Some(p) = prefix {
                batch.push(format!("{}{}", p, line));
            } else {
                batch.push(line);
            }

            if last_flush.elapsed() >= flush_interval || batch.len() >= 50 {
                dispatcher.emit_log_batch(batch.clone());
                batch.clear();
                last_flush = std::time::Instant::now();
            }
        }
        if !batch.is_empty() {
            dispatcher.emit_log_batch(batch);
        }
    });
}
