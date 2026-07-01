import { Compass } from 'lucide-react';
import styles from '../../../views/AdvancedView.module.css';
import { Toggle } from '../ui/Toggle';
import { useEngineStore } from '../../../store/engineStore';
import type { AdvancedConfig } from '../../../store/engineStore';

interface Props {
  config: AdvancedConfig;
  update: <K extends keyof AdvancedConfig>(key: K, value: AdvancedConfig[K]) => void;
}

export function TProxyCard({ config: c, update }: Props) {
  const { language } = useEngineStore();
  const isTr = language === 'tr';

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <Compass size={18} className={styles.cardIcon} style={{ color: '#a855f7' }} />
        <h3>{isTr ? 'Proxy & IPSet Listeleri' : 'Proxy & IPSet Lists'}</h3>
      </div>
      <div className={styles.settingsList}>
        {/* TPWS Proxy Mode Toggle */}
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <label>{isTr ? 'TPWS Proxy Modu' : 'TPWS Proxy Mode'}</label>
            <span>{isTr ? 'Ham paket manipülasyonu yerine şeffaf SOCKS5 proxy sunucusu başlatır. (--socks)' : 'Starts a local SOCKS5 transparent proxy instead of raw packet diversion. (--socks)'}</span>
          </div>
          <Toggle checked={c.tpwsMode} onChange={(v) => update('tpwsMode', v)} />
        </div>

        {/* IPSet Path */}
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <label>{isTr ? 'IPSet Dosya Yolu' : 'IPSet List Path'}</label>
            <span>{isTr ? 'Sadece bu dosyadaki hedef IP adreslerine desync kuralları uygular. (--ipset)' : 'Only desynchronize connection requests targeting IP addresses in this file. (--ipset)'}</span>
          </div>
          <input 
            type="text" 
            className={styles.textInput} 
            value={c.ipsetPath} 
            onChange={(e) => update('ipsetPath', e.target.value)} 
            placeholder="e.g. ipset_ranges.txt"
          />
        </div>
      </div>
    </div>
  );
}
