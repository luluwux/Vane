<p align="center">
  <img src="src-tauri/icons/icon.png" width="128" alt="Vane Logo">
</p>

<h1 align="center">Vane DPI</h1>

<p align="center">
  <strong>Advanced DPI Bypass Utility & Network Protection Suite</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.7-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/platform-Windows-blue.svg" alt="Platform">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/Built_with-Tauri_v2-orange.svg" alt="Tauri">
</p>

---

## 🚀 Overview

**Vane** is a professional-grade DPI (Deep Packet Inspection) bypass tool designed for high-performance network evasion. It provides a sleek, modern interface to manage complex packet manipulation techniques, secure DNS forwarding, and automated health monitoring.

Built with **Tauri v2** and **Rust**, Vane offers industry-leading memory safety and minimal resource footprint while delivering a premium user experience.

---

## ✨ Key Features

### 💎 DPI Bypass Engine
- **Advanced Desync:** Multi-layered packet desynchronization (Fake, Split, Disorder, OOB).
- **Protocol Agnostic:** Works across TCP and UDP (QUIC) for seamless web browsing and gaming.
- **Dynamic Optimization:** Heuristic scanning to find the best bypass rules for your specific ISP.

### 🛡️ Secure DNS (DoH)
- **DoH Forwarder:** Local UDP listener (Port 5353) that forwards plain DNS to encrypted Cloudflare/Google DoH.
- **DNS Guard:** Automatically detects and remediates insecure ISP DNS hijacking.
- **Trusted Providers:** Integrated support for Cloudflare, Google, and Custom DNS.

### 🌐 Remote Presets System
- **Cloud Sync:** Fetches the latest bypass rules from the [Vane-Presets](https://github.com/luluwux/Vane-Presets) repository.
- **CVE-5 Protection:** Every remote manifest is verified via **Minisign Ed25519** digital signatures to prevent tampering.

### ⚡ System Integration
- **Auto-Start:** Deep integration with Windows Task Scheduler for silent background startup (Admin required).
- **Tray Management:** Full control via system tray even when the main window is closed.
- **Auto-Updater:** Built-in delta update system to keep you on the latest version.

---

## 🔒 Security Hardening

Vane is designed with a "Security First" philosophy, implementing protections against common vulnerabilities:

- **CVE-2 (Argument Injection):** All engine arguments are strictly sanitized using whitelist regex patterns.
- **CVE-5 (Manifest Hijacking):** Remote presets use asymmetric cryptography for integrity verification.
- **Privilege Separation:** Dangerous operations (DNS, Autostart) are gated behind explicit elevation checks.

---

## 🛠️ Technology Stack

- **Frontend:** React + Vite + Framer Motion
- **Backend:** Rust (Tauri v2 Framework)
- **Networking:** WinDivert (Windows Packet Filter)
- **Communication:** Async IPC Channels & Pooled HTTP Clients

---

## 📥 Installation

1. Download the latest installer from the [Releases](https://github.com/luluwux/Vane/releases) page.
2. Run `Vane_0.1.7_x64_en-US.msi` or the portable `.exe`.
3. For best results, run as **Administrator** to enable DNS Guard and Auto-Start features.

---

## 🤝 Community & Support

- **Discord:** [Join our server](https://discord.gg/luppux)
- **Developer:** [@Lulushu](https://discord.com/users/852103749228036136)
- **Issues:** Please report bugs via the GitHub Issues tab.

---

<p align="center">
  <i>Developed with ❤️ by Archey Agency</i>
</p>
