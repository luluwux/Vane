import { Shield } from 'lucide-react';
import styles from '../../../views/AdvancedView.module.css';
import { Toggle } from '../ui/Toggle';
import { NumberInput } from '../ui/NumberInput';
import type { AdvancedConfig } from '../../../store/engineStore';

interface Props {
  config: AdvancedConfig;
  update: <K extends keyof AdvancedConfig>(key: K, value: AdvancedConfig[K]) => void;
}

export function PacketTrafficCard({ config: c, update }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <Shield size={18} className={styles.cardIcon} />
        <h3>Packet &amp; Traffic</h3>
      </div>
      <div className={styles.settingsList}>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <label>Auto TTL</label>
            <span>Automatically pick a safe fake TTL for the target.</span>
          </div>
          <Toggle checked={c.autoTtl} onChange={(v) => update('autoTtl', v)} />
        </div>

        {!c.autoTtl && (
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <label>Fake TTL</label>
              <span>Fake packet life (3-8 is recommended for strict ISPs).</span>
            </div>
            <NumberInput value={c.fakeTtl} min={1} max={20} onChange={(v) => update('fakeTtl', v)} />
          </div>
        )}

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <label>MSS Fix</label>
            <span>MTU/MSS size for fragmented packets.</span>
          </div>
          <NumberInput value={c.mssFix} min={800} max={1500} onChange={(v) => update('mssFix', v)} />
        </div>
      </div>
    </div>
  );
}
