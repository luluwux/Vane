import styles from '../../../views/AdvancedView.module.css';

interface NumberInputProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}

export function NumberInput({ value, min = 1, max = 9999, onChange }: NumberInputProps) {
  return (
    <div className={styles.numInputContainer}>
      <button className={styles.numBtn} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <div className={styles.numValue}>{value}</div>
      <button className={styles.numBtn} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}
