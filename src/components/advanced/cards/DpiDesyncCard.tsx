import { ServerCrash } from 'lucide-react';
import styles from '../../../views/AdvancedView.module.css';
import { Toggle } from '../ui/Toggle';
import { NumberInput } from '../ui/NumberInput';
import { CheckboxList } from '../ui/CheckboxList';
import type { AdvancedConfig } from '../../../store/engineStore';

const FOOLING_OPTIONS = ['md5sig', 'badseq', 'badsum', 'datanoack'];

interface Props {
  config: AdvancedConfig;
  update: <K extends keyof AdvancedConfig>(key: K, value: AdvancedConfig[K]) => void;
}

export function DpiDesyncCard({ config: c, update }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <ServerCrash size={18} className={styles.cardIcon} />
        <h3>DPI Desynchronization</h3>
      </div>
      <div className={styles.settingsList}>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <label>Desync Method</label>
            <span>Packet splitting or corruption tactic. (--dpi-desync)</span>
          </div>
          <div className={styles.flexCol}>
            <select className={styles.selectBox} value={c.desyncMethod} onChange={(e) => update('desyncMethod', e.target.value)}>
              <option value="none">None</option>
              <option value="split">Split (Default)</option>
              <option value="split2">Split2</option>
              <option value="disorder">Disorder</option>
              <option value="fake">Fake</option>
              <option value="oob">OOB</option>
              <option value="custom">Custom</option>
            </select>
            {c.desyncMethod === 'custom' && (
              <input type="text" className={`${styles.textInput} ${styles.mt2}`} placeholder="e.g: fake,multidisorder" value={c.customDesyncMethod} onChange={(e) => update('customDesyncMethod', e.target.value)} />
            )}
          </div>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <label>Any Protocol</label>
            <span>Apply to all protocols, not just HTTP/S.</span>
          </div>
          <Toggle checked={c.anyProtocol} onChange={(v) => update('anyProtocol', v)} />
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <label>Split Position</label>
            <span>At which byte the packet is split.</span>
          </div>
          <NumberInput value={c.splitPosition} min={1} max={40} onChange={(v) => update('splitPosition', v)} />
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <label>Desync Repeats</label>
            <span>How many times the manipulation will be repeated.</span>
          </div>
          <NumberInput value={c.desyncRepeats} min={1} max={20} onChange={(v) => update('desyncRepeats', v)} />
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <label>Desync Fooling</label>
            <span>Packet signature changes to fool DPI.</span>
          </div>
          <CheckboxList options={FOOLING_OPTIONS} selected={c.desyncFooling} onChange={(vals) => update('desyncFooling', vals)} />
        </div>
      </div>
    </div>
  );
}
