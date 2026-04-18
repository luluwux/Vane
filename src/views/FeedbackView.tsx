import { motion } from 'framer-motion';
import { MessageSquare, Server, Code, ExternalLink } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';
import styles from './FeedbackView.module.css';

export function FeedbackView() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>Feedback & Community</h2>
        <p className={styles.subtitle}>Join our community, report bugs, or request new features.</p>
      </header>

      <div className={styles.grid}>
        {/* Discord Profile */}
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrapper} ${styles.discordIcon}`}>
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className={styles.cardTitle}>Developer</h3>
              <p className={styles.cardSubtitle}>@Lulushu</p>
            </div>
          </div>
          <button
            className={`${styles.actionBtn} ${styles.discordBtn}`}
            onClick={() => open('https://discord.com/users/852103749228036136')}
          >
            <ExternalLink size={14} /> Send a Message
          </button>
        </motion.div>

        {/* Discord Server */}
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrapper} ${styles.serverIcon}`}>
              <Server size={20} />
            </div>
            <div>
              <h3 className={styles.cardTitle}>Discord Community</h3>
              <p className={styles.cardSubtitle}>Vane DPI Official Server</p>
            </div>
          </div>
          <button
            className={`${styles.actionBtn} ${styles.serverBtn}`}
            onClick={() => open('https://discord.gg/luppux')}
          >
            <ExternalLink size={14} /> Join Server
          </button>
        </motion.div>

        {/* GitHub Repository */}
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrapper} ${styles.githubIcon}`}>
              <Code size={20} />
            </div>
            <div>
              <h3 className={styles.cardTitle}>GitHub Repository</h3>
              <p className={styles.cardSubtitle}>Star the project & report issues</p>
            </div>
          </div>
          <button
            className={styles.actionBtn}
            onClick={() => open('https://github.com/luluwux/Vane')}
          >
            <ExternalLink size={14} /> View Repository
          </button>
        </motion.div>
      </div>
    </div>
  );
}
