<p align="center">
  <img src="src-tauri/icons/icon.png" width="128" alt="Vane Logo">
</p>

<h1 align="center">Vane DPI</h1>

<p align="center">
  <strong>Advanced DPI Bypass Utility & Network Protection Suite</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.7-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/platform-Windows%20|%20Linux-blue.svg" alt="Platform">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/Built_with-Tauri_v2-orange.svg" alt="Tauri">
</p>

---

## 🚀 Overview

**Vane** is a professional-grade DPI (Deep Packet Inspection) bypass tool designed for high-performance network evasion. It provides a sleek, modern interface to manage complex packet manipulation techniques, secure DNS forwarding, and automated health monitoring.

Built with **Tauri v2** and **Rust**, Vane offers industry-leading memory safety and minimal resource footprint while delivering a premium user experience on both **Windows** and **Linux**.

---

## ✨ Key Features

### 💎 DPI Bypass Engine
- **Advanced Desync:** Multi-layered packet desynchronization (Fake, Split, Disorder, OOB).
- **Cross-Platform:** Utilizes **WinDivert** on Windows and **NFQUEUE** on Linux.
- **Dynamic Optimization:** Heuristic scanning to find the best bypass rules for your specific ISP.

### 🛡️ Secure DNS (DoH)
- **DoH Forwarder:** Local UDP listener (Port 5353) that forwards plain DNS to encrypted Cloudflare/Google DoH.
- **DNS Guard:** Automatically detects and remediates insecure ISP DNS hijacking.

### 🌐 Remote Presets System
- **Cloud Sync:** Fetches the latest bypass rules from the [Vane-Presets](https://github.com/luluwux/Vane-Presets) repository.
- **Security:** Verified via **Minisign Ed25519** digital signatures.

---

## 👨‍💻 Developer Guide

### 🏗️ Getting Started
To build Vane from source, you need Node.js and Rust (latest stable).

```bash
# 1. Clone the repository
git clone https://github.com/luluwux/Vane.git

# 2. Install dependencies
npm install

# 3. Run in development mode
npm run dev
```

### 📋 Preset Structure
Vane uses a flexible JSON format for bypass rules. Each preset defines icons, labels, and raw engine arguments:

```json
{
  "id": "youtube-fix",
  "label": "YouTube & QUIC Focus",
  "description": "Optimized for UDP 443 acceleration.",
  "icon": "▶️",
  "args": ["--wf-udp=443", "--dpi-desync=fake", "--dpi-desync-autottl"],
  "isCustom": false,
  "category": "quic"
}
```

### 🛡️ Security Architecture (Sanitizer)
All arguments passed to the backend engine are filtered through a strict **Sanitizer** layer in Rust. This prevents shell injection (CVE-2) and ensures only a verified allowlist of `zapret` parameters can be executed.

---

## 🔒 Security Hardening

- **CVE-2 Protection:** Strict argument sanitization whitelist.
- **CVE-5 Protection:** Asymmetric manifest signing for remote updates.
- **Privilege Separation:** Dangerous operations require explicit elevation checks.

---

## 🛠️ Technology Stack & Credits

- **Frontend:** React + Vite + Framer Motion
- **Backend Core:** [zapret](https://github.com/bol-van/zapret) (Powering the packet manipulation engine)
- **Framework:** Tauri v2 (Rust)
- **Networking:** WinDivert (Windows) / Netfilter (Linux)

---

## 📥 Installation

1. Download the latest version from [Releases](https://github.com/luluwux/Vane/releases).
2. For Windows: Run the `.msi` or `.exe`.
3. For Linux: Follow the instructions in the `.deb` or AppImage notes.

---

## 🤝 Community & Support

- **Discord:** [Join our server](https://discord.gg/luppux)
- **Developer:** [@Lulushu](https://discord.com/users/852103749228036136)

---

<p align="center">
  <i>Developed with ❤️ by Archey Agency</i>
</p>
