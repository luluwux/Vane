import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { ArrowUpCircle, X, Loader2 } from 'lucide-react';
import styles from './UpdateBanner.module.css';

interface UpdateInfo {
  version: string;
  body: string | null;
  downloadUrl: string;
}

/// Checks for updates 5 seconds after mount to avoid blocking initial render.
/// Shows a dismissible banner if a new version is available.
/// Uses session-level dismissal — reappears on next app launch.
export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const result = await invoke<UpdateInfo | null>('check_for_updates');
        if (result) {
          setUpdate(result);
        }
      } catch (e) {
        // Update check failure is non-fatal — silently ignored.
        console.debug('Update check skipped:', e);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleInstall = async () => {
    if (!update || isInstalling) return;
    setIsInstalling(true);
    setError(null);

    try {
      await invoke('install_update');
      // install_update triggers app.restart() — this line won't be reached.
    } catch (e) {
      setError(String(e));
      setIsInstalling(false);
    }
  };

  if (dismissed || !update) return null;

  return (
    <AnimatePresence>
      <motion.div
        className={styles.banner}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25 }}
      >
        <div className={styles.left}>
          <ArrowUpCircle size={15} className={styles.icon} />
          <span className={styles.text}>
            <strong>v{update.version}</strong> hazır
          </span>
        </div>

        <div className={styles.actions}>
          {error && <span className={styles.error}>{error}</span>}

          <button
            className={styles.installBtn}
            onClick={handleInstall}
            disabled={isInstalling}
          >
            {isInstalling ? (
              <Loader2 size={12} className={styles.spinner} />
            ) : (
              'Güncelle'
            )}
          </button>

          <button
            className={styles.dismissBtn}
            onClick={() => setDismissed(true)}
            title="Kapat"
          >
            <X size={12} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
