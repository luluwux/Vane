import { motion } from 'framer-motion';
import type { Preset } from '../../types/engine';
import styles from './PresetCard.module.css';

interface PresetCardProps {
  preset: Preset;
  isActive: boolean;
  isEngineRunning: boolean;
  onSelect: (presetId: string) => void;
}

/** Tek bir preset'i temsil eden kart bileşeni. */
export function PresetCard({
  preset,
  isActive,
  isEngineRunning,
  onSelect,
}: PresetCardProps) {
  const isDisabled = isEngineRunning && !isActive;

  const classNames = [
    styles.card,
    isActive && styles['card--active'],
    isDisabled && styles['card--disabled'],
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.button
      className={classNames}
      onClick={() => onSelect(preset.id)}
      disabled={isDisabled}
      aria-pressed={isActive}
      id={`preset-card-${preset.id}`}
      layout
      whileHover={isDisabled ? {} : { scale: 1.01 }}
      whileTap={isDisabled ? {} : { scale: 0.99 }}
      transition={{ duration: 0.15 }}
    >
      <span className={styles.icon} aria-hidden>
        {preset.icon}
      </span>

      <div className={styles.content}>
        <div className={styles.label}>{preset.label}</div>
        <div className={styles.description}>{preset.description}</div>
      </div>

      {preset.isCustom && (
        <span className={styles.customBadge}>Özel</span>
      )}

      {isActive && (
        <motion.div
          className={styles.activeIndicator}
          layoutId="active-indicator"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
      )}
    </motion.button>
  );
}
