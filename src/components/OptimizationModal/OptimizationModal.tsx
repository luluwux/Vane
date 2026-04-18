import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { listen } from '@tauri-apps/api/event';
import styles from './OptimizationModal.module.css';

interface OptimizationModalProps {
  isOpen: boolean;
}

export function OptimizationModal({ isOpen }: OptimizationModalProps) {
  const [step, setStep] = useState('Başlatılıyor...');
  const [presetName, setPresetName] = useState('Hazırlık');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen<{
        step: string;
        presetName: string;
        progressPct: number; // Snake_case was converted to CamelCase by serde maybe? Wait, Rust has `#[serde(rename_all = "camelCase")]` so it is `progressPct`.
      }>('optimize_progress', (event) => {
        setStep(event.payload.step);
        setPresetName(event.payload.presetName);
        setProgress(event.payload.progressPct);
      });
    };

    if (isOpen) {
      setupListener();
      setProgress(0);
      setStep('Test Motoru Isınıyor...');
      setPresetName('Hazırlık');
    }

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={styles.overlay}>
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className={styles.iconContainer}>
              <div className={styles.spinner}></div>
            </div>
            
            <h2 className={styles.title}>Akıllı Tarama Devrede</h2>
            <p className={styles.subtitle}>Sizin için en iyi bağlantı yolunu buluyoruz...</p>
            
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <motion.div 
                  className={styles.progressFill}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <div className={styles.progressStats}>
                <span className={styles.step}>{step}</span>
                <span className={styles.percentage}>{progress}%</span>
              </div>
            </div>

            <div className={styles.currentTest}>
              Denenen Vites: <strong>{presetName}</strong>
            </div>
            
            <p className={styles.warning}>
              Lütfen bu işlem bitene kadar bekleyin. Birkaç saniye sürebilir.
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
