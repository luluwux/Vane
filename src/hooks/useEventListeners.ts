import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useEngineStore } from '../store/engineStore';
import type { EngineStatus } from '../types/engine';

/* 
   Central hook that registers all Tauri backend event listeners.
   Each window (Widget + Settings) sets up its own listener instance.
   The cleanup function unregisters all listeners on unmount to prevent leaks. 
*/
export function useEventListeners(): void {
  const { appendLog, appendLogs, setStatus, refreshDnsStatus, refreshPresets, startEngine } = useEngineStore();

  useEffect(() => {
    let isMounted = true;
    const cleanupFns: Array<() => void> = [];

    const register = async <T>(
      event: string,
      handler: (payload: T) => void,
    ) => {
      const unlisten = await listen<T>(event, (e) => handler(e.payload));
      if (!isMounted) {
        unlisten();
      } else {
        cleanupFns.push(unlisten);
      }
    };

    // winws stdout/stderr lines forwarded from the backend in batches
    register<string[]>('log_batch', (lines) => {
      if (lines.length === 0) return;
      const entries = lines.map(line => ({
        content: line,
        level: classifyLogLevel(line)
      }));
      appendLogs(entries);
    });

    // Engine lifecycle changes (stopped / starting / running / error)
    register<EngineStatus>('engine_status', (status) => {
      setStatus(status);
    });

    // Emitted by apply_dns_settings, reset_dns_settings, start_engine_with_dns_guard
    register<void>('dns_status_changed', () => {
      refreshDnsStatus();
    });

    // Emitted when DNS Guard auto-applies Cloudflare on engine start
    register<string>('dns_auto_applied', (message) => {
      appendLog(`ℹ️ ${message}`, 'warn');
    });

    // WM_DEVICECHANGE fired by network/watcher.rs on adapter changes
    register<void>('network_changed', () => {
      appendLog('⚠️ Network change detected — refreshing DNS status...', 'warn');
      refreshDnsStatus();
    });

    // Keeps activePresetId in sync across the Widget and Settings windows
    register<string>('sync_active_preset', (presetId) => {
      useEngineStore.setState({ activePresetId: presetId });
    });

    return () => {
      isMounted = false;
      cleanupFns.forEach((fn) => fn());
    };
  // Zustand action references are stable — safe to list as deps
  }, [appendLog, appendLogs, setStatus, refreshDnsStatus, refreshPresets, startEngine]);
}

// Infers a log level from the message content.
function classifyLogLevel(content: string): 'info' | 'warn' | 'error' {
  const lower = content.toLowerCase();
  if (lower.includes('error') || lower.includes('fail')) return 'error';
  if (lower.includes('warn') || lower.includes('stderr')) return 'warn';
  return 'info';
}
