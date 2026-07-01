# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.4] - 2026-07-01

### Added
- Expose all advanced Zapret desync parameters in the **Advanced Settings** tab (including HTTP/HTTPS/QUIC protocol-specific methods, desync2 secondary strategy, desync cutoff limits, bind address, and TCP receiver window sizing).
- Multiple checkbox checklists for TCP desync evasion/fooling flags (`badseq`, `badsum`, `md5sig`, `datanoack`, `hopbyhop`, `destopt`).
- Custom payloads & SNI configurations (TLS custom fake SNI domain, custom payload strings/file paths for HTTP/TLS/QUIC fake injections).
- SOCKS5 Transparent Proxy mode using TPWS, and custom IPSet domain ranges list file parsing.
- Cryptographic startup integrity checks: Vane now verifies the SHA-256 hash of `winws.exe` (Windows) and `nfqws` (Linux) before launch to prevent DLL/Binary substitution.

### Changed
- Relocated **Import** and **Export** profile buttons to the top-right header section of the Advanced tab next to the preset dropdown.
- Moved **DNS Leak Protection (Kill Switch)** and **Auto-Recovery Watchdog** settings into the Advanced tab, simplifying the settings sidebar navigation.
- Changed default installation mode to `perMachine` in the installer configuration to protect engine binaries in system protected directories (`Program Files`).
- Expanded DNS socket reading buffers from `512` bytes to `4096` bytes to handle larger EDNS0 DNS packets.

### Fixed
- Fixed critical security bypass in IPC `open_url` command by restricting URIs to safe HTTP/HTTPS schemes.
- Fixed shell command injection breakout on Linux root executor by properly quoting and escaping arguments.
- Fixed unbounded memory growth in DNS Cache by enforcing a 5,000 active entries limit.
- Upgraded local Vite dev dependencies to completely resolve advisory CVEs.
- Fixed UI layout alignments and corrected toggle components styling across DNS, Pattern, and Advanced view containers.
