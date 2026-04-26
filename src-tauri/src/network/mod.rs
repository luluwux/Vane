pub mod watcher;
#[cfg(target_os = "linux")]
pub mod router;

pub use watcher::spawn_network_watcher;
