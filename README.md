<p align="center">
  <img src="src-tauri/icons/icon.png" width="160" alt="Vane Logo">
</p>

<h1 align="center">Vane DPI</h1>

<p align="center">
  <strong>The Ultimate DPI Bypass & Network Security Control Center</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0--beta.1-blue.svg?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/platform-Windows%20|%20Linux-0078D4?style=for-the-badge&logo=windows" alt="Platform">
  <img src="https://img.shields.io/badge/Build-Rust%20|%20Tauri-orange?style=for-the-badge&logo=rust" alt="Tech">
</p>


# Vane

A graphical frontend for [zapret](https://github.com/bol-van/zapret) (winws on Windows). Vane handles process management, preset distribution, DNS-over-HTTPS forwarding, and ISP detection, so you can configure and run the bypass engine without touching the command line.

Built with Tauri (Rust backend, React frontend). Binaries are available for Windows and Debian-based Linux.

---

## Limitations

Vane targets passive DPI — systems that inspect traffic and inject RST/redirect packets without dropping the original. It will **not** help in the following cases:

- Blocking is done purely by IP address (no packet content inspection involved)
- The ISP routes traffic through a full TCP-terminating proxy such as Squid — these reconstruct the TCP stream and are immune to packet-level manipulation
- The connection is subject to active probing by a stateful firewall that can follow retransmissions
- DNS responses are poisoned **and** the blocked IP is also unreachable — DNS Guard handles the DNS part, but if the IP itself is blocked there is nothing the bypass engine can do

For a detailed explanation of when zapret-based tools fail, see [zapret's own documentation](https://github.com/bol-van/zapret/blob/master/docs/readme.en.md#when-it-will-not-work).

---

## How it works

Vane wraps `winws`/`nfqws` — the packet manipulation daemon from the zapret project. At the network level, the daemon intercepts outgoing TCP/UDP traffic via WinDivert (Windows) or NFQUEUE (Linux), modifies or reorders packets so that DPI systems cannot reconstruct the original request, then lets the actual server receive the real data unmodified.

Vane's job is to:
- translate GUI settings into the correct argument string for the daemon
- start and stop the daemon process with those arguments
- apply DNS-over-HTTPS to prevent DNS-level blocking
- distribute and verify preset files via remote sync

---

## Requirements

**Windows:** Administrator privileges are required. WinDivert needs kernel-level access to capture and inject packets. Running without elevation will fail silently.

**Linux:** Debian-based distributions. Use the `.deb` package or the `.AppImage`. You need permission to use NFQUEUE (typically root or `CAP_NET_ADMIN`).

---

## Installation

Download the latest release from [Releases](https://github.com/luluwux/Vane/releases).

| Platform | Package |
|---|---|
| Windows | `.msi` or `.exe` installer |
| Debian / Ubuntu | `.deb` |
| Other Linux | `.AppImage` |

Run the installer, then launch Vane as Administrator (Windows) or with appropriate privileges (Linux).

---

## Presets

Presets are named argument bundles for the zapret engine. Each preset maps to a specific `--dpi-desync` strategy and a set of protocol/port filters. Vane ships with a default set and syncs updates from [Vane-Presets](https://github.com/luluwux/Vane-Presets) over HTTPS.

| Preset | Strategy | Notes |
|---|---|---|
| Default | `fake,multidisorder` | Good starting point for most ISPs |
| YouTube Fix | `fake` on UDP 443 (QUIC) | Targets QUIC/HTTP3 specifically |
| Deep Fragmentation | `multisplit` at multiple positions | For SNI-based filters |
| OOB | `fake` + out-of-band TCP signal | For stateful firewalls |

Remote presets are signed with [Minisign (Ed25519)](https://jedisct1.github.io/minisign/). Vane will reject any preset file that fails signature verification, even if it was fetched over HTTPS.

---

## Advanced configuration

The Advanced tab lets you build a custom argument string for the daemon. The parameters below map directly to `winws`/`nfqws` flags. See the [zapret documentation](https://github.com/bol-van/zapret/blob/master/docs/readme.en.md) for the full reference.

### Desync method (`--dpi-desync`)

The core parameter. Accepts a comma-separated list of up to three modes in phase order. **Modes must be specified in ascending phase order** (0 → 1 → 2). Specifying a phase 2 mode before a phase 1 mode is invalid.

- Phase 0 modes act during the TCP handshake
- Phase 1 modes inject packets before the first real data segment
- Phase 2 modes modify how the original data is sent

| Mode | Phase | Description |
|---|---|---|
| `synack` | 0 | Modifies the TCP handshake (SYN/SYN-ACK phase). |
| `syndata` | 0 | Sends data in the SYN packet. Most OS ignore SYN data, but some DPIs do not. |
| `fake` | 1 | Injects a fake packet before the real one. The fake must not reach the server (controlled by TTL or fooling flags). DPI reads the fake; the server discards it. |
| `fakeknown` | 1 | Like `fake`, but only on protocols nfqws recognizes (TLS, HTTP, QUIC). Skips unknown protocols. |
| `rst` | 1 | Sends a TCP RST before the real packet. Some DPIs stop tracking a session on RST. |
| `rstack` | 1 | RST with ACK flag set. |
| `multisplit` | 2 | Splits the packet at positions defined by `--dpi-desync-split-pos` and sends fragments in order. |
| `multidisorder` | 2 | Same as `multisplit` but sends fragments in reverse order. The server reassembles correctly; DPI may not. |
| `fakedsplit` | 2 | Single-position split with fake packets interleaved around each segment. |
| `fakeddisorder` | 2 | Same as `fakedsplit` with reversed segment order. |
| `hostfakesplit` | 2 | Fakes only the hostname portion of the request. Generates random decoy hostnames around the real one. |
| `ipfrag2` | 2 | IP-level fragmentation of the modified packets. |
| `udplen` | 2 | (UDP only) Pads UDP payload to a different length. Resists DPIs that match on exact packet sizes. |
| `tamper` | 2 | Generic payload modification without fragmentation. |

Example combinations:
```
--dpi-desync=fake,multidisorder
--dpi-desync=fake,multisplit --dpi-desync-split-pos=1,sniext+1,midsld
--dpi-desync=fake --dpi-desync-ttl=5 --dpi-desync-fooling=badsum
```

### Fooling mode (`--dpi-desync-fooling`)

Controls how fake packets are made unacceptable to the server while still being processed by DPI.

| Value | Description |
|---|---|
| `ttl` | Sets a low TTL on fake packets. They expire before reaching the server. Requires tuning per ISP — if DPI is further away than local servers, you may lose access to those servers. Use with `autottl` to automate. |
| `badsum` | Sets an invalid TCP checksum on fakes. The server drops them; many DPI appliances do not verify checksums. Does not work if you are behind NAT that rejects invalid checksums (common in default Linux router configs). |
| `badseq` | Sets an out-of-window sequence number on fakes. The server ignores them. Default offset is -10000. |
| `md5sig` | Adds an MD5 TCP option (RFC 2385) to fakes. Only Linux servers typically implement this; others ignore the option. |
| `datanoack` | Sends fakes without the ACK flag. Most servers reject these. May break NAT in some configurations. |
| `hopbyhop` | (IPv6 only) Adds a hop-by-hop extension header to fakes. Some DPIs do not walk extension header chains. |
| `hopbyhop2` | (IPv6 only) Adds two hop-by-hop headers, which violates RFC. All OS discard such packets, but some DPIs still process them. |

Multiple values are comma-separated: `--dpi-desync-fooling=badsum,md5sig`

### TTL settings

| Parameter | Description |
|---|---|
| `--dpi-desync-ttl=N` | Static TTL for fake packets. The value must be low enough that fakes expire before the server but high enough to reach the DPI. Requires per-ISP tuning. |
| `--dpi-desync-autottl=[delta[:min-max]]` | Automatic TTL mode. nfqws observes the TTL of the first incoming packet, infers the hop count, then computes a TTL for fakes that expires just before the server. Default delta: `-1:3-20`. Positive delta requires a `+` prefix. Fails gracefully if hop count cannot be determined. |

### Split position (`--dpi-desync-split-pos`)

Comma-separated list of positions where the packet is split. Used by `multisplit`, `multidisorder`, and `fakedsplit`.

| Marker | Resolves to |
|---|---|
| `N` | Absolute byte offset from start |
| `-N` | Absolute byte offset from end |
| `method` | Start of HTTP method (`GET`, `POST`, etc.) |
| `host` | Start of hostname in HTTP Host header or TLS SNI |
| `endhost` | Byte after the last character of the hostname |
| `sld` | Start of second-level domain within the hostname |
| `endsld` | Byte after the SLD |
| `midsld` | Middle of the SLD |
| `sniext` | Start of the data field in the TLS SNI extension |

Example: `--dpi-desync-split-pos=1,sniext+1,host+1,midsld-2,midsld,midsld+2,endhost-1`

Positions that do not apply to the current protocol (e.g. `midsld` on a non-TLS packet) are silently dropped.

### MSS Fix (`--mss`)

> **Note:** `--mss` is a `tpws` parameter and is not applicable when using `winws` on Windows. On Linux, if you are running `nfqws` directly, this option is also unavailable — it only works with the `tpws` transparent proxy daemon. It is documented here for completeness.

Sets the `TCP_MAXSEG` socket option, advertising a low MSS in the SYN packet. This forces the server to send smaller TCP segments, which can split TLS 1.2 ServerHello so DPI cannot read the certificate's domain name. Has no effect on TLS 1.3 (ServerHello is encrypted). Significantly reduces throughput. Use as a last resort if no other method works and you are running `tpws` directly.

### Other parameters

| Parameter | Description |
|---|---|
| `--dpi-desync-repeats=N` | Send each fake packet N times instead of once. |
| `--dpi-desync-split-seqovl=N` | Add sequence number overlap before the first split segment. Allows mixing fake and real data without separate fake packets. |
| `--dpi-desync-any-protocol=1` | Apply desync to any non-empty outgoing packet, not just HTTP and TLS. |
| `--dpi-desync-skip-nosni=0` | Also act on TLS ClientHello packets that have no SNI field. Default is 1 (skip). |
| `--dpi-desync-cutoff=[n\|d\|s]N` | Stop applying desync after packet N (n), data packet N (d), or sequence byte N (s). |
| `--dpi-desync-start=[n\|d\|s]N` | Start applying desync from packet N (n), data packet N (d), or sequence byte N (s). |
| `--wssize=W[:scale]` | Set TCP receive window size advertised to the server. Forces the server to send smaller chunks. Requires conntrack. Slows connections; use only when other methods fail. |
| `--filter-tcp=port` | Apply this profile only to TCP traffic on the specified port(s). |
| `--filter-udp=port` | Apply this profile only to UDP traffic on the specified port(s). |
| `--filter-l7=proto` | Apply this profile only to the specified L7 protocol. Values: `http`, `tls`, `quic`, `wireguard`, `dht`, `discord`, `stun`, `unknown`. |

---

## DNS Guard

When enabled, Vane starts a local DNS-over-HTTPS forwarder listening on `127.0.0.127:5353`. All DNS queries are forwarded to Cloudflare (1.1.1.1) over an encrypted HTTPS connection instead of going to the ISP's resolver.

If Vane detects that the system is using an ISP-provided DNS server, it switches to the DoH forwarder automatically.

To use it manually, point your OS or browser DNS settings to `127.0.0.127:5353`.

---

## Health check

In Settings, you can add up to 3 domains to monitor. Vane periodically sends a connection attempt through the bypass tunnel to each domain and reports whether it succeeded. This is useful for confirming that the active preset is actually unblocking a specific site, or for noticing when a previously working preset stops working after an ISP-side change.

The health check runs independently of the bypass engine state — it will also report failures when the engine is stopped, so you can use it to verify baseline connectivity.

---

## Auto-start (Windows)

Vane can register itself as a scheduled task via Windows Task Scheduler to start automatically at login with Administrator privileges, without requiring a UAC prompt each time.

To enable: open Settings and toggle **Start with Windows**. This creates a task under the current user account that launches Vane at logon using the highest available privilege level.

To remove the task manually if needed:

```
schtasks /delete /tn "Vane" /f
```

---

## Writing presets

Presets are stored in [`presets.json`](https://github.com/luluwux/Vane-Presets) in the remote presets repository. Each entry describes a named strategy that Vane translates into a `winws`/`nfqws` argument string.

Minimal preset structure:

```json
{
  "name": "My Preset",
  "description": "Short description shown in the UI",
  "args": "--dpi-desync=fake,multidisorder --dpi-desync-fooling=badsum --filter-tcp=443 --filter-udp=443"
}
```

| Field | Required | Description |
|---|---|---|
| `name` | yes | Display name in the preset selector |
| `description` | yes | One-line explanation shown in the UI |
| `args` | yes | Raw argument string passed to the daemon. Must pass Vane's whitelist sanitizer — see Security section for which characters are allowed. |

To add a preset for the community: open a PR against [luluwux/Vane-Presets](https://github.com/luluwux/Vane-Presets). Once merged and signed, all Vane clients receive the update automatically on next sync.

---

## Contributing

Contributions are welcome. A few things to know before opening a PR:

**Open an issue first** for anything beyond a small bug fix. This avoids duplicate work and lets us discuss approach before implementation.

**Development setup:**

```sh
git clone https://github.com/luluwux/Vane.git
cd Vane
npm install
npm run tauri dev   # starts the app with hot-reload for the frontend
```

Backend changes (Rust) are picked up automatically by `tauri dev` but require a full recompile, which takes longer than frontend changes.

**Where things live:**

- Frontend UI changes → `src/`
- Daemon process management → `src-tauri/src/engine/`
- Argument sanitizer → `src-tauri/src/engine/` (the whitelist is defined here; any new parameter you want to expose in the UI must be added to the whitelist)
- Preset sync and signature verification → `src-tauri/src/presets/`
- Privilege / UAC handling → `src-tauri/src/privilege/`

**Preset-only contributions** (new strategies, regional fixes) go to the [Vane-Presets](https://github.com/luluwux/Vane-Presets) repo, not here.

---

## Security

**Argument sanitization.** Every parameter passed to the `winws` binary goes through a Rust whitelist sanitizer. Characters and flags not explicitly allowed by the policy are rejected before the process is started. This prevents argument injection via malformed preset files.

**Preset signature verification.** Remote preset manifests (`presets.json`) are signed with Minisign (Ed25519). Vane verifies the signature before loading any remote preset. A compromised distribution server cannot deliver unsigned or incorrectly signed data.

---

## Building from source

Dependencies: [Rust](https://rustup.rs) (stable), [Node.js](https://nodejs.org) (LTS). See the [Contributing](#contributing) section for the full development setup.

```sh
npm run tauri build    # production build
```

**Repository layout:**

```
src/                        React frontend (TypeScript, Vite)
src-tauri/
  src/
    engine/                 Daemon process management and argument sanitizer
    privilege/              Administrator / CAP_NET_ADMIN checks
    presets/                Remote sync and Minisign verification
  icons/
presets/                    Bundled default presets
.github/workflows/          CI and release automation
```

---

## Troubleshooting

**Engine starts but no connectivity.** The current `Fake TTL` may be too low or too high for your ISP. Enable `Auto TTL` first. If that does not help, try switching to `Standard Split` (no fake packets).

**WinDivert error on startup.** Only one application can hold the WinDivert handle at a time. Check that GoodbyeDPI, PowerTunnel, or another DPI tool is not already running.

**ISP info shows N/A.** The geolocation API request failed. This is usually a rate limit or a temporary network issue. It does not affect bypass functionality.

**YouTube fix does not work.** Make sure the YouTube Fix preset is targeting UDP 443. Some ISPs also throttle TCP 443 — in that case you may need a separate TCP profile.

**No preset works at all.** Run zapret's [`blockcheck.sh`](https://github.com/bol-van/zapret/blob/master/blockcheck.sh) on Linux to find which `--dpi-desync` combination your ISP is vulnerable to. On Windows, the equivalent is running `blockcheck.cmd` from the zapret release. Take the output strategy and create a custom preset in Vane's Advanced tab with those arguments.

---

## Credits

- **zapret** by [bol-van](https://github.com/bol-van/zapret) — the underlying bypass engine
- **Tauri** — application framework
- **Minisign** — preset signature verification

---

## License

[GPL-3.0](LICENSE)

## Support

If you found this project helpful, please consider leaving a 🌟 star. Thank you!

<p align="center"\>
</p\>

- [My Discord Profile](https://discord.com/users/852103749228036136)

- If you find any errors, you can contact luppux
<br> </br>
<p align="center">
  <a href="https://discord.gg/luppux" target="_blank">
    <img src="https://api.weblutions.com/discord/invite/luppux/" alt="Discord Banner">
  </a>
</p>
