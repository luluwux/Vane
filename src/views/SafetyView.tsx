import { useState, useEffect } from 'react';
import { useEngineStore } from '../store/engineStore';
import { ShieldAlert, EyeOff, Save } from 'lucide-react';
import { Toast } from '../components/Toast/Toast';
import styles from './SafetyView.module.css';

export function SafetyView() {
  const {
    killSwitch,
    watchdog,
    setKillSwitch,
    setWatchdog,
    status
  } = useEngineStore();

  const [localKillSwitch, setLocalKillSwitch] = useState(killSwitch);
  const [localWatchdog, setLocalWatchdog] = useState(watchdog);
  const [showToast, setShowToast] = useState(false);

  const isRunning = status.variant === 'running';

  useEffect(() => {
    setLocalKillSwitch(killSwitch);
    setLocalWatchdog(watchdog);
  }, [killSwitch, watchdog]);

  const handleSave = () => {
    setKillSwitch(localKillSwitch);
    setWatchdog(localWatchdog);
    setShowToast(true);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>Safety & Privacy</h2>
        <p className={styles.subtitle}>
          Enforce firewall rules to block DNS leaks and enable automatic preset recovery on network disruption.
        </p>
      </header>

      <div className={styles.section}>
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
            Blocks standard DNS queries (UDP/TCP Port 53) to the internet, enforcing all DNS traffic through Vane DoH/DoT loopback. Prevents your ISP from detecting the web domains you query. Note: System firewall rules are applied and will be cleared when the engine stops.
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
            Performs background health checks on test targets (e.g. discord.com). If the watchdog detects that connection has been blocked by your ISP, it triggers a recovery event to prompt preset optimization or restore bypass tunnel.
          </p>
        </div>
      </div>

      {isRunning && (localKillSwitch !== killSwitch) && (
        <div className={styles.warningBox}>
          <span>⚠️ Restart the bypass engine to apply the DNS Kill Switch firewall configuration!</span>
        </div>
      )}

      <footer className={styles.footer}>
        <button className={styles.saveBtn} onClick={handleSave}>
          <Save size={16} />
          Save Configurations
        </button>
      </footer>

      {showToast && (
        <div className={styles.toastWrapper}>
          <Toast
            message="Safety configurations saved successfully!"
            type="success"
            onDismiss={() => setShowToast(false)}
          />
        </div>
      )}
    </div>
  );
}
