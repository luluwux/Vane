import { Radio } from 'lucide-react';
import styles from '../../../views/AdvancedView.module.css';
import { Toggle } from '../ui/Toggle';
import type { AdvancedConfig } from '../../../store/engineStore';

interface Props {
  config: AdvancedConfig;
  update: <K extends keyof AdvancedConfig>(key: K, value: AdvancedConfig[K]) => void;
}

export function ProtocolPortsCard({ config: c, update }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <Radio size={18} className={styles.cardIcon} />
        <h3>Protocol &amp; Ports</h3>
      </div>
      <div className={styles.settingsList}>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <label>QUIC / UDP Handling</label>
            <span>Include UDP 443 traffic (YouTube, Discord, etc.) in bypass.</span>
          </div>
          <Toggle checked={c.quicUdpHandling} onChange={(v) => update('quicUdpHandling', v)} />
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <label>HTTP Ports</label>
            <span>Ports to enter the bypass engine (comma separated).</span>
          </div>
          <input 
            type="text" 
            className={styles.textInput} 
            value={c.httpPorts} 
            onChange={(e) => update('httpPorts', e.target.value)} 
          />
        </div>
      </div>
    </div>
  );
}
