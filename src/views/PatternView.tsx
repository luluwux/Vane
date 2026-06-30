import { useState, useEffect } from 'react';
import { useEngineStore } from '../store/engineStore';
import { Globe, Shield, Ban, Save, AlertCircle } from 'lucide-react';
import { Toast } from '../components/Toast/Toast';
import styles from './PatternView.module.css';

export function PatternView() {
  const {
    bypassMode,
    domainList,
    setBypassMode,
    setDomainList,
    status
  } = useEngineStore();

  const [localMode, setLocalMode] = useState<'all' | 'whitelist' | 'blacklist'>(bypassMode);
  const [localList, setLocalList] = useState<string>(domainList);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning'>('success');

  const isEngineRunning = status.variant === 'running';

  // Sync local state when store state changes (e.g., loaded from disk)
  useEffect(() => {
    setLocalMode(bypassMode);
    setLocalList(domainList);
  }, [bypassMode, domainList]);

  const handleSave = () => {
    setBypassMode(localMode);
    
    // Clean domain list: trim spaces, remove empty lines
    const cleanedList = localList
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    setDomainList(cleanedList);
    setLocalList(cleanedList);

    setToastType('success');
    setToastMessage(
      isEngineRunning
        ? 'Settings saved. Restart the bypass engine to apply changes!'
        : 'Pattern configurations saved successfully!'
    );
    setShowToast(true);
  };

  const domainCount = localList
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0).length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>Bypass Pattern Control</h2>
        <p className={styles.subtitle}>
          Configure domain filtering rules to selectively apply or exclude the DPI desynchronization engine.
        </p>
      </header>

      {/* Mode Selection Cards */}
      <div className={styles.cardsGrid}>
        {/* Bypass All */}
        <div
          className={`${styles.card} ${localMode === 'all' ? styles.activeCard : ''}`}
          onClick={() => setLocalMode('all')}
        >
          <div className={`${styles.iconWrapper} ${styles.blueIcon}`}>
            <Globe size={20} />
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardTitle}>Bypass All Sites</span>
            <span className={styles.cardDesc}>Apply desynchronization rules to all outgoing connection requests.</span>
          </div>
        </div>

        {/* Whitelist */}
        <div
          className={`${styles.card} ${localMode === 'whitelist' ? styles.activeCard : ''}`}
          onClick={() => setLocalMode('whitelist')}
        >
          <div className={`${styles.iconWrapper} ${styles.greenIcon}`}>
            <Shield size={20} />
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardTitle}>Only Whitelist</span>
            <span className={styles.cardDesc}>Only apply desynchronization rules to domains listed below.</span>
          </div>
        </div>

        {/* Blacklist */}
        <div
          className={`${styles.card} ${localMode === 'blacklist' ? styles.activeCard : ''}`}
          onClick={() => setLocalMode('blacklist')}
        >
          <div className={`${styles.iconWrapper} ${styles.redIcon}`}>
            <Ban size={20} />
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardTitle}>Exclude Blacklist</span>
            <span className={styles.cardDesc}>Desynchronize all connections except for domains listed below.</span>
          </div>
        </div>
      </div>

      {/* Domain Editor Section */}
      {localMode !== 'all' && (
        <div className={styles.editorSection}>
          <div className={styles.editorHeader}>
            <span className={styles.editorLabel}>Domain List</span>
            <span className={styles.badge}>{domainCount} domain{domainCount !== 1 ? 's' : ''} listed</span>
          </div>

          <textarea
            className={styles.textarea}
            value={localList}
            onChange={(e) => setLocalList(e.target.value)}
            placeholder="example.com&#10;*.google.com&#10;youtube.com"
            spellCheck={false}
          />
          <span className={styles.helperText}>
            Enter one domain per line. Wildcards (e.g., *.example.com) are supported.
          </span>
        </div>
      )}

      {/* Warning if engine is active */}
      {isEngineRunning && (
        <div className={styles.warningBox}>
          <AlertCircle size={15} />
          <span>The bypass engine is currently active. You must restart the engine to apply new patterns.</span>
        </div>
      )}

      {/* Save Action */}
      <footer className={styles.footer}>
        <button className={styles.saveBtn} onClick={handleSave}>
          <Save size={16} />
          Save Configurations
        </button>
      </footer>

      {/* Toast Feedback */}
      {showToast && (
        <div className={styles.toastWrapper}>
          <Toast
            message={toastMessage}
            type={toastType}
            onDismiss={() => setShowToast(false)}
          />
        </div>
      )}
    </div>
  );
}
