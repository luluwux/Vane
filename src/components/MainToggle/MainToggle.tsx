import { motion, AnimatePresence } from 'framer-motion';
import type { EngineStatus } from '../../types/engine';
import styles from './MainToggle.module.css';

interface MainToggleProps {
  status: EngineStatus;
  onToggle: () => void;
  disabled?: boolean;
}

type StatusKey = 'stopped' | 'starting' | 'running' | 'error';

const STATUS_LABELS: Record<StatusKey, string> = {
  stopped:  'Kapalı',
  starting: 'Başlıyor',
  running:  'Aktif',
  error:    'Hata',
};

/** Framer Motion varyantları — toggle duruma göre ölçek ve opaklık */
const buttonVariants = {
  idle: { scale: 1 },
  tap:  { scale: 0.95 },
};

export function MainToggle({ status, onToggle, disabled = false }: MainToggleProps) {
  const statusKey = status.variant as StatusKey;
  const label = STATUS_LABELS[statusKey];
  const isDisabled = disabled || statusKey === 'starting';

  return (
    <div className={styles.toggleWrapper}>
      <motion.button
        className={styles.toggleButton}
        onClick={onToggle}
        disabled={isDisabled}
        variants={buttonVariants}
        initial="idle"
        whileTap={isDisabled ? 'idle' : 'tap'}
        aria-label={`DPI bypass ${label.toLowerCase()}`}
        aria-pressed={statusKey === 'running'}
        id="main-toggle-btn"
      >
        {/* Arka plan glow halkası */}
        <div
          className={[
            styles.glowRing,
            styles[`glowRing--${statusKey}`],
          ].join(' ')}
        />

        {/* Starting: pulse animasyonu */}
        <AnimatePresence>
          {statusKey === 'starting' && (
            <motion.div
              className={styles.pulseRing}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>

        {/* Running: orbit ring */}
        <AnimatePresence>
          {statusKey === 'running' && (
            <motion.div
              className={styles.orbitRing}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.4 }}
            />
          )}
        </AnimatePresence>

        {/* İç buton */}
        <div
          className={[
            styles.buttonInner,
            styles[`buttonInner--${statusKey}`],
          ].join(' ')}
        >
          <PowerIcon statusKey={statusKey} />
          <span
            className={[
              styles.statusText,
              styles[`statusText--${statusKey}`],
            ].join(' ')}
          >
            {label}
          </span>
        </div>
      </motion.button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PowerIcon — SVG ikonu duruma göre renklenir
// ---------------------------------------------------------------------------

function PowerIcon({ statusKey }: { statusKey: StatusKey }) {
  return (
    <svg
      className={[styles.powerIcon, styles[`powerIcon--${statusKey}`]].join(' ')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}
