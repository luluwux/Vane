<p align="center">
  <img src="src-tauri/icons/icon.png" width="160" alt="Vane Logo">
</p>

<h1 align="center">Vane DPI</h1>

<p align="center">
  <strong>The Ultimate DPI Bypass and Network Security Control Center</strong>
</p>

<p align="center">
  <a href="README.tr.md">[![tr](https://img.shields.io/badge/lang-tr-blue.svg)](README.tr.md)</a>
</p>

---

## Table of Contents

- [1. Overview and Project Goals](#1-overview-and-project-goals)
- [2. How Deep Packet Inspection (DPI) Works](#2-how-deep-packet-inspection-dpi-works)
  - [2.1. Passive DPI vs Active DPI](#21-passive-dpi-vs-active-dpi)
  - [2.2. SNI and Hostname Extraction](#22-sni-and-hostname-extraction)
  - [2.3. Block Injection (RST and Redirects)](#23-block-injection-rst-and-redirects)
  - [2.4. DNS Poisoning](#24-dns-poisoning)
- [3. Zapret Architecture and nfqws/winws Core](#3-zapret-architecture-and-nfqwswinws-core)
- [4. Advanced Evasion Techniques and Evasion Mechanics](#4-advanced-evasion-techniques-and-evasion-mechanics)
  - [4.1. TCP Segmentation and Ordering Options](#41-tcp-segmentation-and-ordering-options)
  - [4.2. Fake Packet Injection and Fooling Modes](#42-fake-packet-injection-and-fooling-modes)
  - [4.3. Customizing Fake ClientHello Payloads](#43-customizing-fake-clienthello-payloads)
  - [4.4. Sequence Number Overlaps (seqovl)](#44-sequence-number-overlaps-seqovl)
  - [4.5. IP ID Assignment Schemes](#45-ip-id-assignment-schemes)
  - [4.6. Handshake Reassembly (Kyber and Fragmented ClientHello)](#46-handshake-reassembly-kyber-and-fragmented-clienthello)
  - [4.7. UDP Desync and QUIC/VoIP Evasion](#47-udp-desync-and-quicvoip-evasion)
  - [4.8. Server-Side Response Manipulation (wssize)](#48-server-side-response-manipulation-wssize)
  - [4.9. Duplicates Injection](#49-duplicates-injection)
  - [4.10. Original Packet Modding](#410-original-packet-modding)
  - [4.11. SYNDATA Mode](#411-syndata-mode)
  - [4.12. IP Cache Management](#412-ip-cache-management)
  - [4.13. Connection Tracking (Conntrack)](#413-connection-tracking-conntrack)
- [5. Vane System Features](#5-vane-system-features)
  - [5.1. DNS Guard (Local DoH/DoT/DoQ forwarder)](#51-dns-guard-local-dohdotdoq-forwarder)
  - [5.2. Safety Controls (Kill Switch and Watchdog)](#52-safety-controls-kill-switch-and-watchdog)
  - [5.3. Upstream Proxy Configuration](#53-upstream-proxy-configuration)
  - [5.4. Log Output Console with Categorized Badges](#54-log-output-console-with-categorized-badges)
- [6. Combining Advanced Parameters (Practical Strategies)](#6-combining-advanced-parameters-practical-strategies)
- [7. Firewall and Linux Integration (Iptables/Nftables)](#7-firewall-and-linux-integration-iptablesnftables)
- [8. Limitations and When Evasion Fails](#8-limitations-and-when-evasion-fails)
- [9. Codebase Architecture and Development Guide](#9-codebase-architecture-and-development-guide)
- [10. Troubleshooting and Diagnostics](#10-troubleshooting-and-diagnostics)
- [11. Credits and License](#11-credits-and-license)

---

## 1. Overview and Project Goals

Vane DPI is a high-performance network security console and graphical controller developed for the zapret deep packet inspection circumvention suite (winws on Windows, nfqws on Linux). While the low-level zapret engine is exceptionally powerful, configuring it requires managing raw terminal processes, constructing complex command-line arguments, and manually configuring system network adapters and firewall policies. 

Vane addresses these challenges by wrapping the daemon in a secure desktop environment. It automates process execution, manages local firewall rules, implements encrypted DNS routing, and performs real-time connection checks. The goal is to provide a central graphical hub for power users, network administrators, and developers to deploy DPI evasion rules safely and efficiently.

---

## 2. How Deep Packet Inspection (DPI) Works

To design effective evasion strategies, it is critical to understand the architecture of the inspection systems deployed by Internet Service Providers (ISPs).

### 2.1. Passive DPI vs Active DPI

- **Passive DPI**: Installed via network optical splitters or mirror ports (TAP). It receives a copy of the network traffic but does not sit directly in the transmission path. Because it cannot drop original packets, it prevents access by injecting spoofed TCP RST (Reset) packets or HTTP redirects, hoping they reach the client before the server's real response.
- **Active DPI**: Deployed inline (directly in the transmission path). It can delay, drop, modify, or rate-limit packets in real time. Evasion here is more difficult because the system can drop packets that look suspicious.

### 2.2. SNI and Hostname Extraction

DPI appliances inspect the initial handshake phase of encrypted connections.
- **HTTP**: The system inspects the plain-text Host: header in the HTTP request payload.
- **HTTPS (TLS)**: The system inspects the Server Name Indication (SNI) extension inside the plain-text ClientHello packet. If the SNI matches a blocked domain pattern, the inspection system triggers block injection.

### 2.3. Block Injection (RST and Redirects)

When a forbidden domain is identified:
- The passive DPI injector sends a spoofed TCP packet with the RST or FIN flag set to both the client and the server.
- For HTTP connections, it may send a spoofed HTTP 302 redirect packet pointing to an ISP warning page.
- If the fake packet arrives at the destination before the real packet, the socket is torn down, resulting in a connection failure.

### 2.4. DNS Poisoning

Before a TCP connection can be established, the domain name must be resolved. ISPs often intercept UDP/TCP port 53 DNS requests. They either return spoofed IP addresses pointing to block portals (DNS hijacking) or drop the requests entirely.

---

## 3. Zapret Architecture and nfqws/winws Core

The underlying engine used by Vane is based on zapret. It utilizes:
- **WinDivert** on Windows: A kernel-level driver that captures, modifies, and injects network packets using user-space filters.
- **NFQUEUE** on Linux: An iptables/nftables target that forwards packets to user-space queues for manipulation.

The daemon process receives captured packets, parses their transport and application layers, modifies selected fields based on active filters, and re-injects them into the network stack.

---

## 4. Advanced Evasion Techniques and Evasion Mechanics

This section details the packet-level manipulation methods exposed in Vane's Advanced tab and how they defeat inspection algorithms.

### 4.1. TCP Segmentation and Ordering Options

DPI units rely on high-speed hardware reassembly buffers. If they cannot rebuild the TCP stream, they cannot inspect the payload.

- **multisplit**: Splits the TCP payload at multiple predefined boundary offsets specified in the split position list.
- **multidisorder**: Splits the payload and sends the resulting segments in reverse order (e.g., segment 2 is sent before segment 1). The target server's OS TCP/IP stack buffers segment 2, receives segment 1, and reassembles them in the correct order for the application layer. The DPI, however, must maintain state tables for out-of-order packets, which is resource-intensive and often bypassed.
- **fakedsplit**: Performs a single-position split with fake packets interleaved around the segments. It injects decoy data packets before the segments to satisfy the DPI tracking logic. The segments are ordered sequentially.
- **fakeddisorder**: Similar to fakedsplit but sends the original segments in reverse order.
- **hostfakesplit**: Specifically designed to hide the hostname. It splits the request around the host header, inserting fake hostnames before and after the real segment.

#### Markers and Split Positions
Positions for splitting are evaluated dynamically using markers.
- **method**: Resolves to the start of the HTTP method (GET, POST, etc.).
- **host**: Resolves to the start of the hostname in HTTP or TLS SNI.
- **endhost**: Resolves to the byte after the last character of the hostname.
- **sld**: Resolves to the second-level domain start.
- **endsld**: Resolves to the byte after the second-level domain.
- **midsld**: Resolves to the middle of the second-level domain.
- **sniext**: Resolves to the data field inside the TLS SNI extension.

Example configurations:
`--dpi-desync-split-pos=method+2,midsld` resolves to method+2 for HTTP, and midsld for TLS connections.

#### Segment Ordering and Altorders
The parameter `--dpi-desync-fakedsplit-mod=altorder=N` adjusts segment sequencing:
- **altorder=0**: Fake first segment, real first segment, fake first segment, fake second segment, real second segment, fake second segment.
- **altorder=1**: Real first segment, fake first segment, fake second segment, real second segment, fake second segment.
- **altorder=2**: Real first segment, fake second segment, real second segment, fake second segment.
- **altorder=3**: Real first segment, fake second segment, real second segment.
- **altorder=8**: Real packet, fake packet.
- **altorder=16**: Real packet only (fakes are excluded).

### 4.2. Fake Packet Injection and Fooling Modes

Fake packet injection sends a decoy packet containing forbidden keywords (like a fake SNI pointing to a blocked domain) to satisfy the DPI sensor. Once the DPI processes the fake payload, it assumes the session is already blocked or handled and stops tracking it. The client then sends the real packet. To prevent the real server from receiving the fake payload and terminating the connection, we must apply a fooling mode:

- **ttl**: Sets the Time-To-Live (TTL) on the fake packet to a value just low enough that it reaches the ISP's DPI sensor but drops off the network before reaching the destination server. Requires testing the hop distance to avoid server-side connection drops. Note that some stock router firmwares overwrite outgoing TTL fields; this option will not work if TTL locking is active.
- **badsum**: Generates a fake packet with an incorrect TCP checksum. The destination server's OS discards the packet, but many DPI units ignore checksum validation. Note: This requires setting `net.netfilter.nf_conntrack_checksum=0` on intermediate Linux NAT routers to prevent them from dropping the packet. Default home routers (Linux-based) often drop invalid checksum packets in the FORWARD chain unless conntrack checksumming is explicitly disabled.
- **badseq**: Uses a sequence number that falls outside the server's active TCP window. The server ignores it as out-of-window noise. The default increment is -10000. If the DPI is stateful and tracks window size, this can be ignored by the DPI as well. For complete assurance, setting the increment to 0x80000000 forces the packet entirely outside the sequence space.
- **md5sig**: Adds an RFC 2385 MD5 signature option to the TCP header. Most non-Linux servers discard packets with invalid MD5 signatures. This option requires extra space in the TCP header and may trigger MTU overflows during fragmented Kyber ClientHello exchanges.
- **datanoack**: Sends fake packets with the ACK flag unset. Most destination servers discard packets without ACK flags, while DPIs often parse them anyway. This option may conflict with network address translation (NAT) and masquerade configurations on some routers.
- **ts**: Appends a spoofed TCP timestamp (TSval) offset, causing the server's Protection Against Wrapped Sequence Numbers (PAWS) mechanism to reject the packet. Requires timestamps to be enabled on the client operating system. For Windows, this is enabled using:
  `netsh interface tcp set global timestamps=enabled`
- **autottl**: Dynamically measures the TTL of incoming packets from the server, deduces the hop distance, and automatically calibrates the fake packet's TTL value to ensure it expires before reaching the target. It relies on standard base TTL values (64, 128, 255) to determine the hop distance.

### 4.3. Customizing Fake ClientHello Payloads

Vane supports modifying the raw payloads of injected TLS fakes to prevent fingerprint-based block rules:
- **rnd**: Randomizes the Random and Session ID fields in the TLS structure on every request.
- **rndsni**: Randomizes the SNI extension using a random second-level domain name and common top-level domain extension.
- **dupsid**: Copies the Session ID from the original ClientHello packet to make the fake packet appear as part of the same session.
- **sni=domain**: Rewrites the SNI extension to point to a permitted domain (e.g., iana.org), adjusting internal length headers automatically.
- **padencap**: Extends the padding extension inside the fake TLS payload by the size of the original packet, ensuring size signature checks are bypassed.

### 4.4. Sequence Number Overlap (seqovl)

The `seqovl` method modifies TCP sequence numbers to create overlapping data ranges.
- A fake segment is sent with sequence numbers that overlap with the subsequent real segment.
- When the destination server reassembles the stream, it prioritizes the real data (which arrives later or overwrites the overlap depending on the OS implementation).
- The DPI sensor, assuming the first incoming data is final, registers the fake data, resulting in a mismatch between what the DPI inspected and what the server processed. Note: Windows servers do not preserve sequence overlaps in the same manner as Linux/Unix nodes, so seqovl may fail against Windows-hosted sites.

### 4.5. IP ID Assignment Schemes

To bypass stateful inspections that monitor IP packet headers for consistency, Vane allows configuring how IP Identification fields are assigned:
- **seq**: Increments the IP ID sequentially for each injected packet.
- **seqgroup**: Matches the IP ID of the fake segment with its corresponding original segment.
- **rnd**: Assigns random IP IDs to all packets.
- **zero**: Forces the IP ID field to zero (Linux/BSD hosts).

### 4.6. Handshake Reassembly (Kyber and Fragmented ClientHello)

Modern browsers utilize post-quantum cryptography (such as ML-KEM/Kyber) which increases the size of the TLS ClientHello beyond a single MTU limit (typically 1500 bytes). This splits the SNI across packet boundaries naturally.
- Stateful DPIs reassemble these packets before inspecting.
- Vane's backend monitors the incoming stream, detects multi-packet handshakes, waits for all fragments to arrive, and then applies the configured desync strategy across the fully reassembled message block before re-injecting.

### 4.7. UDP Desync and QUIC/VoIP Evasion

QUIC (HTTP/3) operates over UDP port 443. Unlike TCP, UDP does not support stream segmentation.
- Evasion is performed by injecting fake UDP payloads (using `fake` or `fakeknown` modes), padding lengths (`udplen`), or utilizing IPv6-specific options.
- The `udplen` parameter increases or decreases the UDP payload length by a set offset, preventing length-based signature matching.
- VoIP and Discord voice protocols use high range UDP ports (e.g., 50000-65535). Vane provides presets to apply fake injection specifically to these ranges to stabilize connection state.

### 4.8. Server-Side Response Manipulation (wssize)

If the DPI blocks connections based on the server's response (e.g., reading the server's certificate in the `ServerHello`), Vane can limit the TCP Window Size (`--wssize`) advertised to the server during the handshake. This forces the server to fragment its response into small segments, preventing the DPI from reading the certificate in a single packet.
- wssize specifies the scale factor (e.g., `1:6`).
- It reduces connection throughput during the initial handshake but bypasses server-side SNI inspectors.
- Once the initial request is transmitted, Vane's internal connection tracker cuts off window size limitation to restore full download speeds.

### 4.9. Duplicates Injection

The `--dup=N` parameter instructs Vane to inject duplicate copies of original packets prior to sending them.
- Duplicates can be modified with custom TTLs (`--dup-ttl`) or autottl policies (`--dup-autottl`).
- By introducing duplicates with anomalies (like MD5 signatures or custom flags), the DPI is forced to process contradictory packets, making it drop session tracking.

### 4.10. Original Packet Modding

Vane can modify the headers of original packets. Using `--orig-ttl` or `--orig-autottl`, you can alter the TTL of real data packets. This obscures the signature of the client operating system and forces the DPI to calculate incorrect hop measurements when comparing original and fake flows.

### 4.11. SYNDATA Mode

Normally, TCP SYN packets contain no payload. SYNDATA mode inserts a data payload (typically 16 null bytes or custom data) inside the SYN packet. While the destination OS ignores the payload unless TCP Fast Open (TFO) is active, the DPI attempt to parse this data, causing its tracking engine to lose synchronization with the actual handshake phase.

### 4.12. IP Cache Management

To apply automated TTL adjustments from the first packet of a session, Vane maintains an internal in-memory IP cache.
- It maps destination IP addresses and network interfaces to calculated hop distances and hostnames.
- This allows autottl to function instantly for subsequent connections to the same host.
- The cache lifetime defaults to 2 hours, customizable via `--ipcache-lifetime`.

### 4.13. Connection Tracking (Conntrack)

Vane contains a lightweight stateful connection tracking module to coordinate multi-packet reassembly and window size adjustments.
- It monitors the state of TCP connections (SYN, ESTABLISHED, FIN) and UDP flows.
- It dynamically removes inactive connections after timeouts expire.
- For diagnostic purposes, sending a `SIGUSR1` signal to the daemon triggers a conntrack table dump to standard output.

---

## 5. Vane System Features

In addition to wrapping the zapret core, Vane implements several integrated networking services.

### 5.1. DNS Guard (Local DoH/DoT/DoQ forwarder)
DNS Guard runs a local resolver on `127.0.0.127:5353`.
- It converts standard UDP port 53 queries into encrypted DNS-over-HTTPS, DNS-over-TLS, or DNS-over-QUIC requests.
- It caches resolved records in memory to decrease latency.
- It filters queries against local blocklists (StevenBlack hosts list) to block advertising, telemetry, and malware domains at the DNS level.

### 5.2. Safety Controls (Kill Switch and Watchdog)
- **Kill Switch**: Applies native firewall rules (using Windows Filtering Platform or iptables) to block outbound UDP/TCP port 53 traffic, preventing DNS leaks outside the secure tünel.
- **Watchdog**: Periodically runs ICMP ping or HTTP head requests to specified domains (like `discord.com`). If access is lost, it attempts to recover the connection by restarting the engine or running an optimization scan.

### 5.3. Upstream Proxy Configuration
Allows tunneling DNS Guard's outgoing DoH queries through a SOCKS5 proxy, concealing the lookup path from the ISP.

### 5.4. Log Output Console with Categorized Badges
The logs console parses stdout and stderr from the underlying processes and applies colored tags:
- `[MOTOR]`: Zapret engine status and execution logs (purple).
- `[DNS]`: DNS Guard queries, caching events, and protocol changes (green).
- `[ADBLOCK]`: AdBlock list filtering events (red).
- `[GÜVENLİK]`: Windows elevation state, sanitization, and driver locks (yellow).
- `[SİSTEM]`: Autostart actions and network change detection (blue).
- `[HATA]`: Process execution errors and critical failures (red).
- `[UYARI]`: Non-critical warnings and recovery attempts (amber).

---

## 6. Combining Advanced Parameters (Practical Strategies)

To construct an effective bypass strategy, parameters must be combined based on the inspection type.

### Strategy 1: Standard Split Evasion (Safe, High Compatibility)
Best for basic DPI setups and older home routers. It does not generate fake packets.
```
--wf-tcp=80,443 --dpi-desync=split --dpi-desync-split-pos=2
```
*Mechanism*: Splits all HTTP and TLS handshakes at byte offset 2.

### Strategy 2: Autottl with Fake Packet Injection (Aggressive, ISP Evasion)
Used when the ISP blocks SNI string matches and accepts fake packets.
```
--wf-tcp=80,443 --dpi-desync=fake,multidisorder --dpi-desync-autottl=-1:3-20 --dpi-desync-fooling=badseq --dpi-desync-any-protocol
```
*Mechanism*:
1. Observes the server's TTL.
2. Injects a fake packet with calculated TTL and a bad sequence number.
3. Sends the remaining original segments in reverse order.

### Strategy 3: Turkey ISP Bypass (TR 1 Default Preset)
Specifically optimized for restrictive networks in Turkey.
```
--wf-tcp=80,443 --wf-udp=443 --dpi-desync=split --dpi-desync-any-protocol --dpi-desync-cutoff=d3 --dpi-desync-split-pos=4 --dpi-desync-fooling=md5sig --dpi-desync-autottl
```
*Mechanism*:
- Targets both TCP (web browsing) and UDP (QUIC/HTTP3).
- Uses split desync with absolute split position 4.
- Adds MD5 signature option to protect against fake processing.
- Automatically calculates TTL bounds to restrict packet propagation.

---

## 7. Firewall and Linux Integration (Iptables/Nftables)

When running on Linux, `nfqws` requires redirecting traffic to the user-space NFQUEUE target.

### Iptables Setup Example
```bash
# Redirect outgoing HTTP and HTTPS traffic to nfqws queue 1
iptables -A OUTPUT -p tcp -m multiport --dports 80,443 -j NFQUEUE --queue-num 1 --queue-bypass

# Redirect incoming traffic (required for autottl calculations)
iptables -A INPUT -p tcp -m multiport --sports 80,443 -j NFQUEUE --queue-num 1 --queue-bypass
```

### Nftables Setup Example
```nftables
table inet vane_filter {
    chain bypass_out {
        type filter hook output priority filter; policy accept;
        tcp dport { 80, 443 } queue num 1 bypass
    }
    chain bypass_in {
        type filter hook input priority filter; policy accept;
        tcp sport { 80, 443 } queue num 1 bypass
    }
}
```

---

## 8. Limitations and When Evasion Fails

Packet-level manipulation is not a universal solution:
1. **IP Blocking**: If the target server's IP address is blocked at the routing layer, modifying the payload will not help. A VPN or proxy is required.
2. **Active TCP Reconstruction**: If the ISP routes traffic through a transparent proxy that fully terminates and rebuilds TCP connections, Vane's modified packets will be absorbed by the proxy.
3. **Active Probing**: Some firewalls perform active probing, sending probe packets back to the client to verify if the connection is legitimate.

---

## 9. Codebase Architecture and Development Guide

Vane's codebase is split into Rust (backend) and React/TypeScript (frontend).

```
src/                        React frontend (components, stores, styles)
src-tauri/
  src/
    engine/                 Process management, logger, argument sanitizer
    dns/                    Local forwarder, caching, AdGuard filtering
    presets/                Sync and Minisign signature checks
    logging.rs              Tracing subscriber with tag classification
    commands.rs             Tauri API commands exposed to frontend
```

### Argument Sanitizer
To prevent command injection, `src-tauri/src/engine/sanitizer.rs` validates all arguments against a strict whitelist before launching the process. Any argument or character not present in the whitelist is rejected.

---

## 10. Troubleshooting and Diagnostics

- **WinDivert driver fail**: Ensure no other DPI bypass tools (such as GoodbyeDPI) are running.
- **DNS Leak detected**: Ensure the Kill Switch is enabled in the Safety & Proxy tab.
- **Log shows [HATA]**: Check if Vane is running with Administrator privileges.

---

## 11. Credits and License

- **zapret** by bol-van: The underlying bypass engine.
- **Tauri**: The application framework.
- **Minisign**: Cryptographic signature verification.

Licensed under the MIT License.
