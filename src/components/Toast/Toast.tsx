import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import styles from './Toast.module.css';

interface ToastProps {
  message: string | null;
  type?: 'error' | 'success' | 'warning';
  onDismiss: () => void;
  /** Otomatik kapanma süresi (ms). 0 = manuel kapatma */
  duration?: number;
}

const ICONS = {
  error:   '⚠',
  success: '✓',
  warning: '!',
};

/** Hata ve bilgi bildirimi bileşeni. */
export function Toast({
  message,
  type = 'error',
  onDismiss,
  duration = 5000,
}: ToastProps) {
  useEffect(() => {
    if (!message || duration === 0) return;

    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className={`${styles.toast} ${styles[`toast--${type}`]}`}
          role="alert"
          aria-live="assertive"
          id="toast-notification"
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <span className={styles.icon} aria-hidden>
            {ICONS[type]}
          </span>
          <span className={styles.message}>{message}</span>
          <button
            className={styles.closeBtn}
            onClick={onDismiss}
            aria-label="Bildirimi kapat"
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
