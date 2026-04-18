import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { PresetCard } from '../components/PresetCard/PresetCard';
import { Toast } from '../components/Toast/Toast';
import { OptimizationModal } from '../components/OptimizationModal/OptimizationModal';
import { usePresets } from '../hooks/usePresets';
import { useEngineStore } from '../store/engineStore';
import type { Preset } from '../types/engine';
import styles from './PatternView.module.css';

export function PatternView() {
  const { activePresetId, status, stopEngine } = useEngineStore();
  const { presets } = usePresets();

  const isRunning = status.variant === 'running';
  const isStarting = status.variant === 'starting';
  const engineError = status.variant === 'error' ? status.message : null;

  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    presets[0]?.id ?? 'standard-bypass',
  );

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optSuccess, setOptSuccess] = useState('');
  const [localError, setLocalError] = useState('');

  const handleAutoOptimize = async () => {
    if (isRunning) {
      await stopEngine();
    }

    setIsOptimizing(true);
    setOptSuccess('');

    try {
      const bestPreset = await invoke<Preset>('start_auto_optimize');
      setIsOptimizing(false);
      setOptSuccess(`Best pattern found and applied: ${bestPreset.label} ✅`);
      setSelectedPresetId(bestPreset.id);
    } catch (err: unknown) {
      setIsOptimizing(false);
      const msg = err instanceof Error ? err.message : String(err);
      setLocalError(`Smart Scan error: ${msg}`);
    }
  };

  const activeId = isRunning ? activePresetId : selectedPresetId;
  const currentError = engineError || localError;

  const clearCurrentError = () => {
    setLocalError('');
    if (status.variant === 'error') {
      useEngineStore.getState().setStatus({ variant: 'stopped' });
    }
  };

  const handlePresetSelect = useCallback(
    (presetId: string) => {
      setSelectedPresetId(presetId);
      if (!isRunning) {
        useEngineStore.setState({ activePresetId: presetId });
      }
    },
    [isRunning],
  );

  return (
    <div className={styles.view}>
      <section className={styles.presetsSection}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionTitle}>Select Pattern</span>
            {isRunning && (
              <span className={styles.lockedBadge}>Engine active</span>
            )}
          </div>

          <button
            className={styles.autoOptimizeBtn}
            disabled={isRunning || isStarting || isOptimizing}
            onClick={handleAutoOptimize}
          >
            ✨ Smart Scan
          </button>
        </div>

        <div className={styles.presetList}>
          <AnimatePresence>
            {presets.map((preset, i) => (
              <motion.div
                key={preset.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <PresetCard
                  preset={preset}
                  isActive={preset.id === activeId}
                  isEngineRunning={isRunning}
                  onSelect={handlePresetSelect}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      <OptimizationModal isOpen={isOptimizing} />

      <div className={styles.toastContainer}>
        <Toast
          message={currentError || optSuccess}
          type={optSuccess ? 'success' : 'error'}
          onDismiss={() => { clearCurrentError(); setOptSuccess(''); }}
        />
      </div>
    </div>
  );
}
