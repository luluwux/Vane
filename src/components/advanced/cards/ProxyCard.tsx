import { Network } from 'lucide-react';
import styles from '../../../views/AdvancedView.module.css';
import { useEngineStore } from '../../../store/engineStore';
import { translations } from '../../../utils/translations';

export function ProxyCard() {
  const {
    proxySocks5,
    setProxySocks5,
    language,
  } = useEngineStore();

  const t = translations[language];

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <Network size={18} className={styles.cardIcon} style={{ color: '#10b981' }} />
        <h3>{t.proxy}</h3>
      </div>
      <div className={styles.settingsList}>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <label>{t.socks5Proxy}</label>
            <span>{t.socks5ProxyDesc}</span>
          </div>
          <input 
            type="text" 
            className={styles.textInput} 
            value={proxySocks5} 
            onChange={(e) => setProxySocks5(e.target.value)} 
            placeholder="127.0.0.1:9050"
          />
        </div>
      </div>
    </div>
  );
}
