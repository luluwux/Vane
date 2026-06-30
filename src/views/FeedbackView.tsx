import { invoke } from '@tauri-apps/api/core';
import { MessageSquare, Server, Code, ExternalLink } from 'lucide-react';
import styles from './FeedbackView.module.css';

const openUrl = (url: string) => invoke('open_url', { url });

export function FeedbackView() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>Feedback & Community</h2>
        <p className={styles.subtitle}>Join our community, report bugs, or request new features.</p>
      </header>

      <div className={styles.grid}>
        {/* Discord Profile */}
        <div className={styles.card}>
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
            onClick={() => openUrl('https://discord.com/users/852103749228036136')}
          >
            <ExternalLink size={14} /> Send a Message
          </button>
        </div>

        {/* Discord Server */}
        <div className={styles.card}>
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
            onClick={() => openUrl('https://discord.gg/luppux')}
          >
            <ExternalLink size={14} /> Join Server
          </button>
        </div>

        {/* GitHub Repository */}
        <div className={styles.card}>
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
            onClick={() => openUrl('https://github.com/luluwux/Vane')}
          >
            <ExternalLink size={14} /> View Repository
          </button>
        </div>
      </div>
    </div>
  );
}
