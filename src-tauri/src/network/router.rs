/// Linux network routing is now handled via the unified root wrapper in manager.rs.
/// This file is kept as a placeholder for future non-wrapper implementations.
#[cfg(target_os = "linux")]
pub struct NetworkRouteGuard;

#[cfg(target_os = "linux")]
impl NetworkRouteGuard {
    pub fn new(_queue_num: u16) -> Result<Self, crate::engine::error::EngineError> {
        Ok(Self)
    }
}
