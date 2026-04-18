import type { EngineStatus, Preset } from './engine';

/** `start_engine` komutunun parametresi */
export interface StartEnginePayload {
  presetId: string;
}

/** `save_custom_preset` komutunun parametresi */
export interface SaveCustomPresetPayload {
  preset: Preset;
}

/** `delete_custom_preset` komutunun parametresi */
export interface DeleteCustomPresetPayload {
  presetId: string;
}

/** `get_engine_status` dönüş tipi */
export type GetEngineStatusResponse = EngineStatus;

/** `list_presets` dönüş tipi */
export type ListPresetsResponse = Preset[];
