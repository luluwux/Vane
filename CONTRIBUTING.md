# Contributing to Vane

Thank you for your interest in contributing to Vane! We welcome community contributions to help improve the project.

## How to Contribute

1. **Fork the Repository:** Create a personal fork on GitHub.
2. **Clone the Fork:** Clone the repository locally.
3. **Create a Branch:** Create a branch for your feature or fix using naming conventions:
   - `feat/feature-name` for new features
   - `fix/bug-name` for bug fixes
   - `docs/doc-updates` for documentation changes
4. **Implement & Test:** Make your changes, compile, and run tests locally (see testing section).
5. **Commit Changes:** Use semantic commit messages (see guidelines).
6. **Submit a PR:** Push changes to your fork and submit a Pull Request to Vane's main branch.

---

## Coding Standards

### Frontend (TypeScript + React + Vite)
- Use functional React components and hooks.
- Style components using CSS Modules (avoid inline styling or global namespace conflicts).
- Ensure strict TypeScript typing (avoid `any`).
- Format code using standard Prettier formatting.

### Backend (Rust + Tauri)
- Avoid using `unwrap()` or `expect()` in production paths. Write clean, crash-free, memory-safe code.
- Implement strict parameter validation and check inputs against sanitizer guidelines.
- Wrap OS-level commands and escape inputs to prevent command injection.

---

## Commit Message Guidelines

We follow standard Semantic Commit formatting:
- `feat: add new proxy mode` (new features)
- `fix: correct DNS buffer overflow truncation` (bug fixes)
- `docs: update setup guidelines` (documentation changes)
- `refactor: clean up DpiDesyncCard` (refactoring code)
- `test: add validate_preset_args unit tests` (adding tests)

---

## Local Development & Testing

### 1. Prerequisites
Ensure you have Node.js (LTS), npm, and Rust installed.

### 2. Run in Development Mode
Start the local development server:
```bash
npm run tauri dev
```

### 3. Verification & Build
Verify that the codebase compiles with no warnings or errors:
```bash
# Verify frontend types and Vite build
npm run build

# Verify backend Rust build
cd src-tauri
cargo check
cargo test
```
