import { useState, useEffect } from 'react';
import { useEngineStore } from '../store/engineStore';
import { ShieldAlert, EyeOff, Network, Save } from 'lucide-react';
import { Toast } from '../components/Toast/Toast';
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
  } = useEngineStore();

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
        <h2 className={styles.title}>Safety & Proxy</h2>
        <p className={styles.subtitle}>
          Firewall protection, DNS leak prevention, auto-recovery, and SOCKS5 proxy routing.
        </p>
      </header>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Privacy & Security</h3>

        {/* Kill Switch Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrapper} ${styles.redIcon}`}>
              <ShieldAlert size={20} />
            </div>
            <div className={styles.cardTitleInfo}>
              <span className={styles.cardTitle}>DNS Leak Protection (Kill Switch)</span>
              <span className={styles.cardDesc}>Block unencrypted outbound DNS port 53 traffic</span>
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
            Blocks standard DNS queries (UDP/TCP Port 53) to the internet, enforcing all DNS traffic through Vane DoH/DoT loopback. Prevents your ISP from detecting the web domains you query.
          </p>
        </div>

        {/* Watchdog Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrapper} ${styles.blueIcon}`}>
              <EyeOff size={20} />
            </div>
            <div className={styles.cardTitleInfo}>
              <span className={styles.cardTitle}>Auto-Recovery Gözlemcisi (Watchdog)</span>
              <span className={styles.cardDesc}>Automatically monitor network access and recover connection</span>
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
            Performs background health checks on test targets (e.g. discord.com). If the watchdog detects that connection has been blocked, it triggers a recovery event to prompt preset optimization or restore bypass tunnel.
          </p>
        </div>
      </div>

      {isRunning && (localKillSwitch !== killSwitch) && (
        <div className={styles.warningBox}>
          <span>⚠️ Restart the bypass engine to apply the DNS Kill Switch firewall configuration!</span>
        </div>
      )}

      <div className={styles.divider} />

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Proxy</h3>

        {/* SOCKS5 Proxy Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrapper} ${styles.proxyIcon}`}>
              <Network size={20} />
            </div>
            <div className={styles.cardTitleInfo}>
              <span className={styles.cardTitle}>SOCKS5 Upstream Proxy</span>
              <span className={styles.cardDesc}>Route DoH DNS queries through an external SOCKS5 proxy</span>
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
            All Vane DNS Guard queries (DoH) will be tunneled through this proxy address. Leave empty to use direct internet connections.
          </p>
        </div>
      </div>

      <footer className={styles.footer}>
        <button className={styles.saveBtn} onClick={handleSave}>
          <Save size={16} />
          Save All
        </button>
      </footer>

      {showToast && (
        <div className={styles.toastWrapper}>
          <Toast
            message="Settings saved successfully!"
            type="success"
            onDismiss={() => setShowToast(false)}
          />
        </div>
      )}
    </div>
  );
}
