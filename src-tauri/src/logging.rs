use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tracing::Subscriber;
use tracing_subscriber::layer::Context;
use tracing_subscriber::prelude::*;
use tracing_subscriber::Layer;

static APP_HANDLE: Mutex<Option<AppHandle>> = Mutex::new(None);

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
            tracing::Level::WARN => "warn",
            tracing::Level::INFO => "info",
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

pub fn init_logging() {
    let _ = tracing_subscriber::registry()
        .with(FrontendTracingLayer)
        .with(tracing_subscriber::fmt::layer())
        .try_init();
}
