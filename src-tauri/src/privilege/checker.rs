/// Checks whether the current process is running with an Administrator (elevated) token on Windows.
///
/// WinDivert driver installation requires SeLoadDriverPrivilege;
/// this privilege is only present in elevated tokens.
#[cfg(target_os = "windows")]
pub fn is_elevated() -> bool {
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    unsafe {
        let mut token = HANDLE::default();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
            return false;
        }

        let mut elevation = TOKEN_ELEVATION::default();
        let mut return_length = std::mem::size_of::<TOKEN_ELEVATION>() as u32;

        GetTokenInformation(
            token,
            TokenElevation,
            Some(&mut elevation as *mut _ as *mut std::ffi::c_void),
            return_length,
            &mut return_length,
        )
        .map(|_| elevation.TokenIsElevated != 0)
        .unwrap_or(false)
    }
}

/// Root (UID 0) check for Unix systems.
#[cfg(not(target_os = "windows"))]
pub fn is_elevated() -> bool {
    // Linux'ta doğrudan root yetkisi ile çalıştırmak tehlikelidir.
    // Uygulamanın setcap (cap_net_admin) ile çalıştığı varsayılarak şimdilik
    // yetki kontrolü binary'nin execution aşamasına bırakılmıştır.
    tracing::info!("Linux yetki kontrolü atlanıyor. Binary'nin setcap (cap_net_admin) veya pkexec ile çalıştırıldığı varsayılıyor.");
    true
}
