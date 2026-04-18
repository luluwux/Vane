use thiserror::Error;

/// Type-safe enum representing engine errors across the application.
/// Automatically serialized to JSON over Tauri IPC via `serde::Serialize`.
#[derive(Debug, Error, Clone)]
pub enum EngineError {
    #[error("Yetersiz yetki: Uygulamanın Yönetici (Administrator) olarak çalışması gerekiyor.")]
    InsufficientPrivileges,

    #[error("Motor zaten çalışıyor.")]
    AlreadyRunning,

    #[error("Motor çalışmıyor.")]
    NotRunning,

    #[error("Geçersiz preset: '{0}'")]
    InvalidPreset(String),

    #[error("Mevcut işlem için geçersiz ID: '{0}'")]
    InvalidId(String),

    #[error("Süreç başlatma hatası: {0}")]
    SpawnFailed(String),

    #[error("Yapılandırma ayrıştırma hatası: {0}")]
    ConfigParseError(String),

    #[error("G/Ç hatası: {0}")]
    IoError(String),

    #[error("Binary bulunamadı: {0}")]
    BinaryNotFound(String),
}

impl From<std::io::Error> for EngineError {
    fn from(e: std::io::Error) -> Self {
        Self::IoError(e.to_string())
    }
}

impl serde::Serialize for EngineError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
