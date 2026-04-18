import { motion } from 'framer-motion';
import styles from '../../../views/AdvancedView.module.css';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

export function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <div
      className={`${styles.toggle} ${checked ? styles.toggleActive : ''}`}
      onClick={() => onChange(!checked)}
    >
      <motion.div
        className={styles.toggleKnob}
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </div>
  );
}
