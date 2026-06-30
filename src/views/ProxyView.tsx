import { useState, useEffect } from 'react';
import { useEngineStore } from '../store/engineStore';
import { Network, Save, HelpCircle } from 'lucide-react';
import { Toast } from '../components/Toast/Toast';
import styles from './ProxyView.module.css';

export function ProxyView() {
  const { proxySocks5, setProxySocks5 } = useEngineStore();
  const [localProxy, setLocalProxy] = useState(proxySocks5);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    setLocalProxy(proxySocks5);
  }, [proxySocks5]);

  const handleSave = () => {
    setProxySocks5(localProxy.trim());
    setShowToast(true);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>Proxy Settings</h2>
        <p className={styles.subtitle}>
          Route encrypted DoH DNS queries through an external SOCKS5 proxy to anonymize lookup destinations.
        </p>
      </header>

      <div className={styles.section}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrapper}>
              <Network size={20} />
            </div>
            <div className={styles.cardTitleInfo}>
              <span className={styles.cardTitle}>SOCKS5 Upstream Proxy</span>
              <span className={styles.cardDesc}>Specify a SOCKS5 proxy address (e.g. Tor tunnel)</span>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <input
              type="text"
              className={styles.input}
              value={localProxy}
              onChange={(e) => setLocalProxy(e.target.value)}
              placeholder="127.0.0.1:9050"
            />
          </div>

          <div className={styles.infoBox}>
            <HelpCircle size={15} className={styles.infoIcon} />
            <p className={styles.infoText}>
              All Vane DNS Guard queries (DoH) will be tunneled through this proxy address. Leave empty to use direct internet connections.
            </p>
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <button className={styles.saveBtn} onClick={handleSave}>
          <Save size={16} />
          Save Configurations
        </button>
      </footer>

      {showToast && (
        <div className={styles.toastWrapper}>
          <Toast
            message="Proxy settings saved successfully!"
            type="success"
            onDismiss={() => setShowToast(false)}
          />
        </div>
      )}
    </div>
  );
}
