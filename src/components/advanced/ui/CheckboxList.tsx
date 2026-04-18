import styles from '../../../views/AdvancedView.module.css';

interface CheckboxListProps {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}

export function CheckboxList({ options, selected, onChange }: CheckboxListProps) {
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);

  return (
    <div className={styles.checkboxList}>
      {options.map(opt => (
        <label key={opt} className={styles.checkboxItem}>
          <input
            type="checkbox"
            className={styles.checkboxInput}
            checked={selected.includes(opt)}
            onChange={() => toggle(opt)}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}
