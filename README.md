<p align="center">
  <img src="src-tauri/icons/icon.png" width="160" alt="Vane Logo">
</p>

<h1 align="center">Vane DPI</h1>

<p align="center">
  <strong>The Ultimate DPI Bypass & Network Security Control Center</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.7-blue.svg?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/platform-Windows%20|%20Linux-0078D4?style=for-the-badge&logo=windows" alt="Platform">
  <img src="https://img.shields.io/badge/Build-Rust%20|%20Tauri-orange?style=for-the-badge&logo=rust" alt="Tech">
</p>

---

## 📖 Introduction

**Vane** is not just another DPI bypass tool; it is a comprehensive network suite designed to restore internet freedom and protect user privacy. By leveraging advanced packet manipulation techniques and encrypted DNS protocols, Vane bypasses state-level censorship (DPI) while ensuring your traffic remains invisible to local observers.

Developed with **Rust** for maximum efficiency and **React** for a premium UX, Vane provides a high-end interface for the legendary [zapret](https://github.com/bol-van/zapret) engine.

---

## 🛠️ Detailed Usage Guide

### 1. Installation & Initialization
*   **Windows:** Download the latest `.msi` or `.exe` from [Releases](https://github.com/luluwux/Vane/releases).
*   **Linux:** Compatible with Debian-based systems via `.deb` and universal `AppImage`.
*   **⚠️ CRITICAL:** On Windows, Vane **must be run as Administrator** to allow the WinDivert driver to capture and modify network packets. Without admin privileges, the engine cannot start.

### 2. Selecting the Right Preset
Vane comes with a curated set of presets optimized for different regions and ISPs:
*   **💎 Default:** The most stable balance of Fake and Multi-disorder techniques.
*   **▶️ YouTube Fix:** Targets UDP 443 (QUIC) specifically to fix buffering and blocks on Google services.
*   **🧩 Deep Fragmentation:** Breaks packets into tiny pieces to confuse SNI-based filters.
*   **🛸 OOB (Out-of-Band):** Uses advanced TCP signals to saturate firewall sensors.

### 3. Understanding the Connection Info
*   **ISP Name & Org:** Vane automatically detects your provider. If this shows "N/A", check your internet connection.
*   **DNS Guard:** If Vane detects you are using an insecure ISP DNS, it will automatically apply Cloudflare (1.1.1.1) to prevent DNS hijacking.
*   **Health Check:** In the settings, you can add up to 3 domains. Vane will periodically check if these sites are reachable through the bypass tunnel.

---

## ⚙️ Advanced Configuration (Deep Dive)

For power users, the **Advanced** tab allows manual tuning of the bypass engine:

| Setting | Description |
| :--- | :--- |
| **Desync Method** | Choose how packets are manipulated (Split, Fake, Disorder, OOB). |
| **Split Position** | The byte offset where the TCP packet is split. Usually `1` or `2`. |
| **Fake TTL** | The Time-to-Live for fake packets. Low values prevent them from reaching the actual server. |
| **Auto TTL** | Automatically calculates the ideal TTL to fool the ISP without breaking connection. |
| **MSS Fix** | Limits Maximum Segment Size (default `1300`) to prevent packet drops on restricted tunnels. |

---

## 🛡️ Security & Privacy

Vane is built to be the most secure tool in its class:

### 🛡️ CVE-2: Argument Injection Defense
Every command passed to the `winws` backend is sanitized. We use a **Rust-native Whitelist Sanitizer** that rejects any character or command not explicitly defined in our security policy.

### 🛡️ CVE-5: Remote Manifest Integrity
Remote presets are fetched via HTTPS, but we don't trust the network. Every `presets.json` manifest is digitally signed with **Minisign (Ed25519)**. Even if our GitHub is compromised, Vane will reject any unsigned or incorrectly signed presets.

### 🛡️ DNS Privacy (DoH)
Vane includes a built-in **DNS-over-HTTPS Forwarder**. It opens a local listener on `127.0.0.1:5353`. You can point your OS or browser to this port to enjoy fully encrypted DNS lookups that bypass local logging.

---

## 👨‍💻 Developer & Contributor Guide

### 📂 Directory Structure
*   `src/`: React frontend (Vite).
*   `src-tauri/src/engine/`: Core logic for managing the bypass process.
*   `src-tauri/src/privilege/`: Windows UAC and Linux privilege elevation checks.
*   `src-tauri/src/presets/`: Remote sync and Minisign verification logic.

### 🚀 Build from Source
```bash
# Install Rust (rustup.rs) and Node.js
npm install
npm run tauri dev # Starts the app in dev mode with HMR
```

### 🛰️ Remote Presets Repo
The dynamic rules are hosted at [Vane-Presets](https://github.com/luluwux/Vane-Presets).
To add a new preset, create a PR there. Once merged and signed, all Vane clients globally will receive the update automatically within minutes.

---

## ❓ Troubleshooting

*   **Engine starts but no internet:** Your ISP might be blocking the specific `Fake TTL`. Try enabling `Auto TTL` or switching to `Standard Split`.
*   **WinDivert Error:** Ensure no other DPI bypass tools (like GoodbyeDPI) are running simultaneously. Only one app can control the WinDivert driver at a time.
*   **ISP Info shows N/A:** This is usually a temporary network issue or a rate limit on the geolocation API.

---

## 📜 Credits & License

- **Core Engine:** [zapret](https://github.com/bol-van/zapret) by bol-van.
- **UI/UX:** Archey Agency Design Team.
- **Framework:** [Tauri](https://tauri.app/).

Vane is released under the **MIT License**. Use responsibly.

---

<p align="center">
  <a href="https://discord.gg/luppux">
    <img src="https://img.shields.io/badge/Discord-Join%20Our%20Community-7289DA?style=for-the-badge&logo=discord" alt="Discord">
  </a>
</p>