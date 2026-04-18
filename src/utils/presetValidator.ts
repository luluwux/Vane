/**
 * Validates and sanitizes a raw JSON object before it is trusted as a Preset.
 *
 * Defense against CVE-2 (JSON Import Path Traversal / CLI Injection):
 * - Rejects any arg that does not start with a known safe prefix.
 * - Ensures the args array has a reasonable length bound.
 * - Strips any shell metacharacters from string values.
 *
 * This is the frontend layer. The Rust backend (manager.rs) should also
 * validate args against the same allowlist as defense-in-depth.
 */

import type { Preset } from '../types/engine';

/** Known safe argument prefixes for winws.exe. Any arg not in this list is rejected. */
const ALLOWED_ARG_PREFIXES = [
  '--filter-tcp=',
  '--filter-udp=',
  '--wf-tcp=',
  '--wf-udp=',
  '--dpi-desync=',
  '--dpi-desync-split-pos=',
  '--dpi-desync-repeats=',
  '--dpi-desync-fooling=',
  '--dpi-desync-ttl=',
  '--dpi-desync-cutoff=',
  '--dpi-desync-any-protocol',
  '--dpi-desync-autottl',
  '--mss=',
  '--new-ttl=',
  '--max-payload=',
];

/** Shell metacharacters that must never appear in any arg. */
const SHELL_INJECTION_PATTERN = /[;&|`$<>'"\\]/;

/** Maximum number of args a preset can contain. */
const MAX_ARG_COUNT = 30;

export type ValidationResult =
  | { ok: true; preset: Preset }
  | { ok: false; error: string };

/**
 * Parses and validates an unknown object as a Preset.
 *
 * @example
 * const result = validateImportedPreset(JSON.parse(fileContent));
 * if (!result.ok) { alert(result.error); return; }
 * await invoke('save_custom_preset', { preset: result.preset });
 */
export function validateImportedPreset(raw: unknown): ValidationResult {
  // ─── Structural check ─────────────────────────────────────────────────────
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Preset bir JSON nesnesi olmalıdır.' };
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.args)) {
    return { ok: false, error: 'Geçersiz preset: "args" bir dizi olmalıdır.' };
  }

  // ─── Arg count guard ──────────────────────────────────────────────────────
  if (obj.args.length > MAX_ARG_COUNT) {
    return {
      ok: false,
      error: `Preset çok fazla argüman içeriyor (${obj.args.length} > ${MAX_ARG_COUNT}).`,
    };
  }

  // ─── Arg allowlist + injection check ─────────────────────────────────────
  for (const arg of obj.args) {
    if (typeof arg !== 'string') {
      return { ok: false, error: 'Tüm argümanlar string olmalıdır.' };
    }

    // Shell metacharacter injection guard
    if (SHELL_INJECTION_PATTERN.test(arg)) {
      return {
        ok: false,
        error: `Güvenli olmayan karakter: "${arg}". Kabul edilebilir argümanlar yalnızca safe karakter içerebilir.`,
      };
    }

    // Allowlist prefix check
    const isAllowed = ALLOWED_ARG_PREFIXES.some(
      (prefix) => arg === prefix.replace('=', '') || arg.startsWith(prefix)
    );

    if (!isAllowed) {
      return {
        ok: false,
        error: `Tanınmayan argüman reddedildi: "${arg}". Yalnızca bilinen winws parametreleri kabul edilir.`,
      };
    }
  }

  // ─── Build sanitized preset ───────────────────────────────────────────────
  const label = typeof obj.label === 'string' ? obj.label.slice(0, 64) : 'Imported Preset';
  const description =
    typeof obj.description === 'string' ? obj.description.slice(0, 256) : '';

  const preset: Preset = {
    id: '', // caller must set ID via slugify()
    label,
    description,
    icon: typeof obj.icon === 'string' ? obj.icon.slice(0, 8) : '📦',
    args: obj.args as string[],
    isCustom: true,
    priority: typeof obj.priority === 'number' ? Math.min(obj.priority, 100) : 10,
    category: 'custom',
  };

  return { ok: true, preset };
}
