use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};
use tracing::Subscriber;
use tracing_subscriber::layer::Context;
use tracing_subscriber::prelude::*;
use tracing_subscriber::Layer;

static APP_HANDLE: Mutex<Option<AppHandle>> = Mutex::new(None);

// Guarantees the subscriber is only ever installed once, even if run() is
// somehow invoked more than once.  A second call to try_init() in release
// builds running as Administrator causes a silent crash; OnceLock prevents it.
static LOG_INIT: OnceLock<()> = OnceLock::new();

pub fn set_app_handle(handle: AppHandle) {
    if let Ok(mut guard) = APP_HANDLE.lock() {
        *guard = Some(handle);
    }
}

struct FrontendTracingLayer;

impl<S> Layer<S> for FrontendTracingLayer
where
    S: Subscriber + for<'a> tracing_subscriber::registry::LookupSpan<'a>,
{
    fn on_event(&self, event: &tracing::Event<'_>, _ctx: Context<'_, S>) {
        struct StringVisitor(String);
        impl tracing::field::Visit for StringVisitor {
            fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
                if field.name() == "message" {
                    self.0 = format!("{:?}", value);
                }
            }
        }

        let mut visitor = StringVisitor(String::new());
        event.record(&mut visitor);

        let metadata = event.metadata();
        let level_str = match *metadata.level() {
            tracing::Level::ERROR => "error",
            tracing::Level::WARN  => "warn",
            tracing::Level::INFO  => "info",
            tracing::Level::DEBUG => "debug",
            tracing::Level::TRACE => "trace",
        };

        if !visitor.0.is_empty() {
            let log_line = format!("[Rust:{}] {}", level_str.to_uppercase(), visitor.0);
            if let Ok(guard) = APP_HANDLE.lock() {
                if let Some(handle) = &*guard {
                    let _ = handle.emit("log_batch", vec![log_line]);
                }
            }
        }
    }
}

/// Installs the global tracing subscriber exactly once.
///
/// This is called by `tauri_plugin_log`'s setup via the `setup` callback.
/// The `OnceLock` guard prevents a second call from panicking / crashing in
/// release builds where `set_global_default` returns an error instead of a
/// no-op.
pub fn init_logging() {
    LOG_INIT.get_or_init(|| {
        let _ = tracing_subscriber::registry()
            .with(FrontendTracingLayer)
            .with(tracing_subscriber::fmt::layer())
            .try_init();
    });
}
