import { useState, useEffect } from 'react';
import { useEngineStore } from '../store/engineStore';
import { Globe, Shield, Ban, Save, X } from 'lucide-react';
import { Toast } from '../components/Toast/Toast';
import { translations } from '../utils/translations';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './PatternView.module.css';

const DOMAIN_ALIASES: Record<string, string[]> = {
  'discord.com': ['discordapp.com', 'discordapp.net', 'discord.gg'],
  'roblox.com': ['robloxlabs.com', 'rbxcdn.com'],
  'youtube.com': ['youtu.be', 'ytimg.com', 'ggpht.com']
};

export function PatternView() {
  const {
    bypassMode,
    whitelistDomains,
    blacklistDomains,
    setBypassMode,
    setWhitelistDomains,
    setBlacklistDomains,
    setDomainList,
    status,
    startEngine,
    stopEngine,
    language,
  } = useEngineStore();

  const t = translations[language];

  const [localMode, setLocalMode] = useState<'all' | 'whitelist' | 'blacklist'>(bypassMode);
  const [localWhitelist, setLocalWhitelist] = useState<string>(whitelistDomains);
  const [localBlacklist, setLocalBlacklist] = useState<string>(blacklistDomains);
  
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning'>('success');

  const isEngineRunning = status.variant === 'running';

  // Sync local state when store state changes (e.g., loaded from disk)
  useEffect(() => {
    setLocalMode(bypassMode);
    setLocalWhitelist(whitelistDomains);
    setLocalBlacklist(blacklistDomains);
  }, [bypassMode, whitelistDomains, blacklistDomains]);

  const cleanDomains = (text: string) => {
    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const resultSet = new Set<string>(lines);

    for (const line of lines) {
      // Clean wildcard prefix (*.example.com -> example.com) to match database aliases
      const cleanDomain = line.replace(/^\*\./, '');
      if (DOMAIN_ALIASES[cleanDomain]) {
        for (const alias of DOMAIN_ALIASES[cleanDomain]) {
          resultSet.add(alias);
          resultSet.add(`*.${alias}`);
        }
      }
    }

    return Array.from(resultSet).join('\n');
  };

  const handleSave = async () => {
    const cleanedWhitelist = cleanDomains(localWhitelist);
    const cleanedBlacklist = cleanDomains(localBlacklist);

    // Save to store
    setBypassMode(localMode);
    setWhitelistDomains(cleanedWhitelist);
    setBlacklistDomains(cleanedBlacklist);
    
    // Sync with the backend's expected single domainList
    let activeList = '';
    if (localMode === 'whitelist') activeList = cleanedWhitelist;
    else if (localMode === 'blacklist') activeList = cleanedBlacklist;
    setDomainList(activeList);

    setLocalWhitelist(cleanedWhitelist);
    setLocalBlacklist(cleanedBlacklist);

    if (isEngineRunning) {
      setToastType('warning');
      setToastMessage(t.restartingEngine);
      setShowToast(true);
      try {
        await stopEngine();
        await new Promise(r => setTimeout(r, 600)); // wait for process cleanup
        await startEngine();
        setToastType('success');
        setToastMessage(t.savedAndRestarted);
      } catch (err) {
        setToastType('error');
        setToastMessage(language === 'tr' ? `Motor yeniden başlatılamadı: ${err}` : `Failed to restart engine: ${err}`);
      }
    } else {
      setToastType('success');
      setToastMessage(t.savedSuccessfully);
      setShowToast(true);
    }
  };

  const handleCancel = () => {
    setLocalMode(bypassMode);
    setLocalWhitelist(whitelistDomains);
    setLocalBlacklist(blacklistDomains);
  };

  const hasChanges = localMode !== bypassMode ||
    (localMode === 'whitelist' && localWhitelist !== whitelistDomains) ||
    (localMode === 'blacklist' && localBlacklist !== blacklistDomains);

  const activeTextareaValue = localMode === 'whitelist' ? localWhitelist : localBlacklist;
  const handleTextareaChange = (val: string) => {
    if (localMode === 'whitelist') {
      setLocalWhitelist(val);
    } else {
      setLocalBlacklist(val);
    }
  };

  const domainCount = activeTextareaValue
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0).length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>{t.bypassPatternControl}</h2>
        <p className={styles.subtitle}>
          {t.bypassPatternDesc}
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
            <span className={styles.cardTitle}>{t.bypassAll}</span>
            <span className={styles.cardDesc}>{t.bypassAllDesc}</span>
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
            <span className={styles.cardTitle}>{t.onlyWhitelist}</span>
            <span className={styles.cardDesc}>{t.onlyWhitelistDesc}</span>
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
            <span className={styles.cardTitle}>{t.excludeBlacklist}</span>
            <span className={styles.cardDesc}>{t.excludeBlacklistDesc}</span>
          </div>
        </div>
      </div>

      {/* Domain Editor Section */}
      <AnimatePresence mode="wait">
        {localMode !== 'all' && (
          <motion.div 
            key={localMode}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className={styles.editorSection}
          >
            <div className={styles.editorHeader}>
              <span className={styles.editorLabel}>
                {localMode === 'whitelist' ? t.whitelistDomains : t.blacklistDomains}
              </span>
              <span className={styles.badge}>
                {domainCount} {language === 'tr' ? 'alan adı listelendi' : `domain${domainCount !== 1 ? 's' : ''} listed`}
              </span>
            </div>

            <textarea
              className={styles.textarea}
              value={activeTextareaValue}
              onChange={(e) => handleTextareaChange(e.target.value)}
              placeholder="example.com&#10;*.google.com&#10;youtube.com"
              spellCheck={false}
            />
            <span className={styles.helperText}>
              {t.wildcardHelper}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Banner (Save / Cancel) */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className={styles.actionBanner}
          >
            <div className={styles.bannerLeft}>
              <div className={styles.bannerDot} />
              <span className={styles.bannerText}>{t.unsavedChanges}</span>
            </div>
            <div className={styles.bannerActions}>
              <button className={styles.cancelBtn} onClick={handleCancel}>
                <X size={14} /> {t.cancel}
              </button>
              <button className={styles.saveBtn} onClick={handleSave}>
                <Save size={14} /> {t.saveChanges}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
