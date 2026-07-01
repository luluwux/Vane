import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, RefreshCw } from 'lucide-react';
import { useEngineStore } from '../../../store/engineStore';
import { translations } from '../../../utils/translations';
import styles from '../../../views/AdvancedView.module.css';

interface UnsavedBannerProps {
  isDirty: boolean;
  isReset: boolean;
  isApplying: boolean;
  profileName: string;
  setProfileName: (val: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function UnsavedBanner({
  isDirty,
  isReset,
  isApplying,
  profileName,
  setProfileName,
  onCancel,
  onSave,
}: UnsavedBannerProps) {
  const { language } = useEngineStore();
  const t = translations[language];

  return (
    <AnimatePresence>
      {isDirty && (
        <motion.div
          className={styles.unsavedBanner}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <div className={styles.unsavedLeft}>
            <div className={styles.unsavedDot} />
            <div className={styles.unsavedText}>
              <span className={styles.unsavedTitle}>{t.unsavedWarning}</span>
              <input
                className={`${styles.unsavedNameInput} ${isReset ? styles.unsavedNameInputMuted : ''}`}
                value={profileName}
                onChange={(e) => !isReset && setProfileName(e.target.value)}
                readOnly={isReset}
                placeholder={language === 'tr' ? 'Profil adı...' : 'Profile name...'}
              />
            </div>
          </div>
          <div className={styles.unsavedActions}>
            <button className={styles.cancelBtn} onClick={onCancel} disabled={isApplying}>
              <X size={14} /> {t.cancel}
            </button>
            <button className={styles.saveBtn} onClick={onSave} disabled={!profileName.trim() || isApplying}>
              {isApplying ? <RefreshCw size={14} className={styles.spin} /> : <Check size={14} />}
              {t.save}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
