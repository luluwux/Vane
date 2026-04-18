import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { load } from '@tauri-apps/plugin-store';
import type { NetworkAdapter } from '../types/network';

export type EngineStatus =
  | { variant: 'stopped' }
  | { variant: 'starting' }
  | { variant: 'running'; pid: number }
  | { variant: 'error'; message: string };

export interface Preset {
  id: string;
  label: string;
  description: string;
  icon: string;
  args: string[];
  isCustom: boolean;
  priority?: number;
  category?: string;
}

export interface LogLine {
  id: string;
  timestamp: Date;
  content: string;
  level: 'info' | 'warn' | 'error';
}

export type AppTab = 'home' | 'logs' | 'custom' | 'test' | 'dns';

export interface DnsProvider {
  id: string;
  name: string;
  primary: string;
  secondary: string;
}

/* 
   Advanced Config
   Gelişmiş ayarların tek obje olarak tutulduğu şema.
   Tüm alanlar persist edilerek settings.json dosyasına yazılır. 
*/
export interface AdvancedConfig {
  // DPI Desynchronization
  desyncMethod: string;       // 'split' | 'split2' | 'disorder' | 'fake' | 'oob' | 'custom' | 'none'
  customDesyncMethod: string; // desyncMethod === 'custom' ise bu kullanılır
  splitPosition: number;      // --dpi-desync-split-pos
  desyncRepeats: number;      // --dpi-desync-repeats
  desyncFooling: string[];    // --dpi-desync-fooling
  anyProtocol: boolean;       // --dpi-desync-any-protocol

  // Packet & Traffic
  autoTtl: boolean;           // --dpi-desync-autottl
  fakeTtl: number;            // --dpi-desync-ttl
  mssFix: number;             // --mss

  // Protocol & Ports
  quicUdpHandling: boolean;   // --wf-udp=443
  httpPorts: string;          // --wf-tcp=
}

export const DEFAULT_ADVANCED_CONFIG: AdvancedConfig = {
  desyncMethod: 'custom',
  customDesyncMethod: 'fake,multidisorder',
  splitPosition: 1,
  desyncRepeats: 1,
  desyncFooling: ['badseq'],
  anyProtocol: true,
  autoTtl: true,
  fakeTtl: 4,
  mssFix: 1300,
  quicUdpHandling: true,
  httpPorts: '80, 443',
};

/* 
   Tauri Store Adapter
   Zustand'ın persist middleware'i için tauri-plugin-store'u depolama motoru
   olarak bağlar. Böylece veriler AppData/com.vane.dpi/settings.json dosyasına
   yazılır — PC yeniden başlasa bile korunur. 
*/

const STORE_FILE = 'settings.json';

function createTauriStorage(): StateStorage {
  return {
    getItem: async (key: string): Promise<string | null> => {
      try {
        const store = await load(STORE_FILE, { autoSave: false } as any);
        const value = await store.get<string>(key);
        return value ?? null;
      } catch {
        return null;
      }
    },
    setItem: async (key: string, value: string): Promise<void> => {
      try {
        const store = await load(STORE_FILE, { autoSave: false } as any);
        await store.set(key, value);
        await store.save();
      } catch (e) {
        console.error('Tauri Store yazma hatası:', e);
      }
    },
    removeItem: async (key: string): Promise<void> => {
      try {
        const store = await load(STORE_FILE, { autoSave: false } as any);
        await store.delete(key);
        await store.save();
      } catch { /* ignore */ }
    },
  };
}

// ─── Store Interface ────────────────────────────────────────────────────────

interface EngineStore {
  // Kalıcı (persist edilecek) alanlar
  activePresetId: string | null;
  selectedDnsId: string;
  dnsCustomPrimary: string;
  dnsCustomSecondary: string;
  advancedConfig: AdvancedConfig;
  healthCheckTargets: string[];

  // Geçici (session) alanlar
  status: EngineStatus;
  presets: Preset[];
  logs: LogLine[];
  activeTab: AppTab;
  dnsProviders: DnsProvider[];
  dnsSynced: boolean;
  advancedDirty: boolean;  // kaydedilmemiş gelişmiş ayar var mı?

  setStatus: (status: EngineStatus) => void;
  setActivePreset: (presetId: string | null) => void;
  setPresets: (presets: Preset[]) => void;
  upsertPreset: (preset: Preset) => void;
  setAdvancedConfig: (config: Partial<AdvancedConfig>) => void;
  resetAdvancedConfig: () => void;
  setAdvancedDirty: (dirty: boolean) => void;
  appendLog: (content: string, level?: LogLine['level']) => void;
  clearLogs: () => void;
  setActiveTab: (tab: AppTab) => void;
  setHealthCheckTargets: (targets: string[]) => void;

  refreshPresets: () => Promise<void>;
  deletePreset: (presetId: string) => Promise<void>;
  startEngine: (presetId?: string) => Promise<void>;
  stopEngine: () => Promise<void>;
  refreshDnsStatus: () => Promise<void>;

  setDnsProviders: (providers: DnsProvider[]) => void;
  setSelectedDnsId: (id: string) => void;
  setDnsCustom: (primary: string, secondary: string) => void;
  setDnsSynced: (synced: boolean) => void;
}

let logCounter = 0;

export const useEngineStore = create<EngineStore>()(
  persist(
    (set, get) => ({
      // Persist edilecek başlangıç değerleri
      activePresetId: 'default',
      selectedDnsId: '',
      dnsCustomPrimary: '',
      dnsCustomSecondary: '',
      advancedConfig: DEFAULT_ADVANCED_CONFIG,

      // Session değerleri (persist edilmez)
      status: { variant: 'stopped' },
      presets: [],
      logs: [],
      activeTab: 'home',
      dnsProviders: [],
      dnsSynced: false,
      advancedDirty: false,
      healthCheckTargets: ['discord.com'],

      setStatus: (status) => set({ status }),
      setActivePreset: async (presetId) => {
        set({ activePresetId: presetId });
        try {
          await emit('sync_active_preset', presetId);
        } catch (err) { /* ignore in dev */ }
      },
      setPresets: (presets) => set({ presets }),
      upsertPreset: (preset) => set((state) => {
        const exists = state.presets.some(p => p.id === preset.id);
        return {
          presets: exists
            ? state.presets.map(p => p.id === preset.id ? preset : p)
            : [...state.presets, preset],
        };
      }),

      setAdvancedConfig: (partial) => set((state) => ({
        advancedConfig: { ...state.advancedConfig, ...partial },
      })),

      resetAdvancedConfig: () => set({ advancedConfig: DEFAULT_ADVANCED_CONFIG }),
      setAdvancedDirty: (advancedDirty) => set({ advancedDirty }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setHealthCheckTargets: (targets) => set({ healthCheckTargets: targets }),
      clearLogs: () => set({ logs: [] }),

      appendLog: (content, level = 'info') => set((state) => {
        const newLine: LogLine = {
          id: String(++logCounter),
          timestamp: new Date(),
          content,
          level,
        };
        return { logs: [newLine, ...state.logs].slice(0, 500) };
      }),

      setDnsProviders: (dnsProviders) => set({ dnsProviders }),
      setSelectedDnsId: (selectedDnsId) => set({ selectedDnsId }),
      setDnsCustom: (dnsCustomPrimary, dnsCustomSecondary) => set({ dnsCustomPrimary, dnsCustomSecondary }),
      setDnsSynced: (dnsSynced) => set({ dnsSynced }),

      refreshPresets: async () => {
        try {
          const fetched = await invoke<Preset[]>('list_presets');
          set({ presets: fetched });
        } catch (err) {
          console.error('Preset listesi çekilemedi:', err);
        }
      },

      deletePreset: async (presetId: string) => {
        try {
          await invoke('delete_custom_preset', { presetId });
          await get().refreshPresets();
          if (get().activePresetId === presetId) {
            await get().setActivePreset('default');
          }
        } catch (err) {
          console.error("Preset silinemedi:", err);
          get().appendLog(`Preset silinirken hata: ${err}`, 'error');
        }
      },

      startEngine: async (presetId) => {
        const id = presetId || get().activePresetId;
        if (!id) return;

        // Seçilen preseti kalıcı olarak kaydet (persist aracılığıyla)
        set({ activePresetId: id, status: { variant: 'starting' } });
        get().appendLog(`Motor başlatılıyor: ${id}`, 'info');

        try {
          const result = await invoke<EngineStatus>('start_engine_with_dns_guard', { presetId: id });
          set({ status: result });

          if (result.variant === 'running') {
            get().appendLog(`Bypass aktif edildi (PID: ${result.pid})`, 'info');
          } else if (result.variant === 'error') {
            get().appendLog(`Motor hatası: ${result.message}`, 'error');
          }
        } catch (err) {
          const errorMsg = String(err);
          set({ status: { variant: 'error', message: errorMsg } });
          get().appendLog(`Başlatma hatası: ${errorMsg}`, 'error');
        }
      },

      stopEngine: async () => {
        try {
          await invoke('stop_engine');
          set({ status: { variant: 'stopped' } });
          get().appendLog('Motor durduruldu.', 'warn');
        } catch (err) {
          console.error('Durdurma hatası:', err);
        }
      },

      refreshDnsStatus: async () => {
        try {
          const [provs, adaps] = await Promise.all([
            invoke<DnsProvider[]>('list_dns_providers'),
            invoke<NetworkAdapter[]>('get_network_adapters'),
          ]);

          set({ dnsProviders: provs });

          // Statik DNS ayarlı adaptörü tercih et, yoksa ilkini al
          const staticAdapter = adaps.find((a) => !a.isDhcp);
          const activeDns = staticAdapter?.currentPrimaryDns ?? adaps[0]?.currentPrimaryDns;

          if (activeDns) {
            const match = provs.find((p) => p.primary === activeDns);
            if (match) {
              set({ selectedDnsId: match.id, dnsSynced: true });
            } else {
              const secondaryAdapter = adaps.find((a) => a.currentPrimaryDns === activeDns);
              set({
                selectedDnsId: 'custom',
                dnsCustomPrimary: activeDns,
                dnsCustomSecondary: secondaryAdapter?.currentSecondaryDns ?? '',
                dnsSynced: true,
              });
            }
          } else {
            set({ dnsSynced: true });
          }
        } catch (err) {
          console.error('DNS Sync Hatası:', err);
        }
      },
    }),
    {
      name: 'vane-settings',           // Tauri Store'daki anahtar adı
      storage: createJSONStorage(createTauriStorage), // Depolama motoru
      // Sadece bu alanlar diske yazılır; session verileri (logs, status vb.) yazılmaz.
      partialize: (state) => ({
        activePresetId: state.activePresetId,
        selectedDnsId: state.selectedDnsId,
        dnsCustomPrimary: state.dnsCustomPrimary,
        dnsCustomSecondary: state.dnsCustomSecondary,
        advancedConfig: state.advancedConfig,
        healthCheckTargets: state.healthCheckTargets,
      }),
    }
  )
);