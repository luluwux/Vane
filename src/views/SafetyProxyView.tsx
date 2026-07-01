import { useState, useEffect } from 'react';
import { useEngineStore } from '../store/engineStore';
import { ShieldAlert, EyeOff, Network, Save } from 'lucide-react';
import { Toast } from '../components/Toast/Toast';
import { translations } from '../utils/translations';
import styles from './SafetyProxyView.module.css';

export function SafetyProxyView() {
  const {
    killSwitch,
    watchdog,
    proxySocks5,
    setKillSwitch,
    setWatchdog,
    setProxySocks5,
    status,
    language,
  } = useEngineStore();

  const t = translations[language];

  const [localKillSwitch, setLocalKillSwitch] = useState(killSwitch);
  const [localWatchdog, setLocalWatchdog] = useState(watchdog);
  const [localProxy, setLocalProxy] = useState(proxySocks5);
  const [showToast, setShowToast] = useState(false);

  const isRunning = status.variant === 'running';

  useEffect(() => {
    setLocalKillSwitch(killSwitch);
    setLocalWatchdog(watchdog);
    setLocalProxy(proxySocks5);
  }, [killSwitch, watchdog, proxySocks5]);

  const handleSave = () => {
    setKillSwitch(localKillSwitch);
    setWatchdog(localWatchdog);
    setProxySocks5(localProxy.trim());
    setShowToast(true);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>{t.safety}</h2>
        <p className={styles.subtitle}>
          {language === 'tr' ? 'Güvenlik duvarı koruması, DNS sızıntı koruması, otomatik kurtarma ve SOCKS5 proxy yönlendirme.' : 'Firewall protection, DNS leak prevention, auto-recovery, and SOCKS5 proxy routing.'}
        </p>
      </header>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t.privacySecurity}</h3>

        {/* Kill Switch Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrapper} ${styles.redIcon}`}>
              <ShieldAlert size={20} />
            </div>
            <div className={styles.cardTitleInfo}>
              <span className={styles.cardTitle}>{t.dnsLeakProtection}</span>
              <span className={styles.cardDesc}>{t.dnsLeakProtectionDesc}</span>
            </div>
            <div className={styles.toggleWrapper}>
              <input
                type="checkbox"
                id="killswitch-toggle"
                className={styles.toggleInput}
                checked={localKillSwitch}
                onChange={(e) => setLocalKillSwitch(e.target.checked)}
              />
              <label htmlFor="killswitch-toggle" className={styles.toggleLabel} />
            </div>
          </div>
          <p className={styles.detailedDesc}>
            {t.dnsLeakProtectionDetailed}
          </p>
        </div>

        {/* Watchdog Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrapper} ${styles.blueIcon}`}>
              <EyeOff size={20} />
            </div>
            <div className={styles.cardTitleInfo}>
              <span className={styles.cardTitle}>{t.watchdog}</span>
              <span className={styles.cardDesc}>{t.watchdogDesc}</span>
            </div>
            <div className={styles.toggleWrapper}>
              <input
                type="checkbox"
                id="watchdog-toggle"
                className={styles.toggleInput}
                checked={localWatchdog}
                onChange={(e) => setLocalWatchdog(e.target.checked)}
              />
              <label htmlFor="watchdog-toggle" className={styles.toggleLabel} />
            </div>
          </div>
          <p className={styles.detailedDesc}>
            {t.watchdogDetailed}
          </p>
        </div>
      </div>

      {isRunning && (localKillSwitch !== killSwitch) && (
        <div className={styles.warningBox}>
          <span>{t.restartEngineWarning}</span>
        </div>
      )}

      <div className={styles.divider} />

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t.proxy}</h3>

        {/* SOCKS5 Proxy Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrapper} ${styles.proxyIcon}`}>
              <Network size={20} />
            </div>
            <div className={styles.cardTitleInfo}>
              <span className={styles.cardTitle}>{t.socks5Proxy}</span>
              <span className={styles.cardDesc}>{t.socks5ProxyDesc}</span>
            </div>
          </div>

          <input
            type="text"
            className={styles.input}
            value={localProxy}
            onChange={(e) => setLocalProxy(e.target.value)}
            placeholder="127.0.0.1:9050 (e.g. Tor)"
          />
          <p className={styles.detailedDesc}>
            {t.socks5ProxyDetailed}
          </p>
        </div>
      </div>

      <footer className={styles.footer}>
        <button className={styles.saveBtn} onClick={handleSave}>
          <Save size={16} />
          {t.saveAll}
        </button>
      </footer>

      {showToast && (
        <div className={styles.toastWrapper}>
          <Toast
            message={t.settingsSaved}
            type="success"
            onDismiss={() => setShowToast(false)}
          />
        </div>
      )}
    </div>
  );
}
