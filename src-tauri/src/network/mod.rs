pub mod watcher;
pub mod stats;
#[cfg(target_os = "linux")]
pub mod router;

pub use watcher::spawn_network_watcher;
pub use stats::get_total_network_bytes;
