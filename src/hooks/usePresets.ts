import { useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEngineStore } from '../store/engineStore';
import type { Preset } from '../types/engine';

interface UsePresetsReturn {
  presets: Preset[];
  builtinPresets: Preset[];
  customPresets: Preset[];
  refreshPresets: () => Promise<void>;
  saveCustomPreset: (preset: Preset) => Promise<void>;
  deleteCustomPreset: (presetId: string) => Promise<void>;
}

/** Preset listesini yöneten hook. */
export function usePresets(): UsePresetsReturn {
  const { presets, setPresets, upsertPreset, deletePreset } = useEngineStore();

  const refreshPresets = useCallback(async () => {
    try {
      const loaded = await invoke<Preset[]>('list_presets');
      setPresets(loaded);
    } catch (err) {
      console.error('Preset yükleme hatası:', err);
    }
  }, [setPresets]);

  // İlk mount'ta preset'leri yükle
  useEffect(() => {
    refreshPresets();
  }, [refreshPresets]);

  const saveCustomPreset = useCallback(
    async (preset: Preset) => {
      await invoke<void>('save_custom_preset', { preset });
      upsertPreset({ ...preset, isCustom: true });
    },
    [upsertPreset],
  );

  const deleteCustomPreset = useCallback(
    async (presetId: string) => {
      await deletePreset(presetId);
    },
    [deletePreset],
  );

  const builtinPresets = presets.filter((p) => !p.isCustom);
  const customPresets = presets.filter((p) => p.isCustom);

  return {
    presets,
    builtinPresets,
    customPresets,
    refreshPresets,
    saveCustomPreset,
    deleteCustomPreset,
  };
}
