import { useEffect, useRef } from 'react';
import type { LogLine } from '../../types/engine';
import styles from './LogViewer.module.css';

interface LogViewerProps {
  logs: LogLine[];
  onClear: () => void;
}

/** Terminal benzeri log görüntüleyici. Yeni satır geldiğinde otomatik scroll yapar. */
export function LogViewer({ logs, onClear }: LogViewerProps) {
  const outputRef = useRef<HTMLDivElement>(null);

  // Yeni log gelince aşağı scroll
  useEffect(() => {
    const el = outputRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  return (
    <div className={styles.viewer}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarTitle}>Engine Output</span>
        <div className={styles.toolbarActions}>
          <span className={styles.logCount}>{logs.length} lines</span>
          <button
            id="log-clear-btn"
            className={styles.toolbarBtn}
            onClick={onClear}
            disabled={logs.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      <div ref={outputRef} className={styles.output} role="log" aria-live="polite">
        {logs.length === 0 ? (
          <div className={styles.empty}>Engine has not been started yet.</div>
        ) : (
          logs.map((line) => <LogLineRow key={line.id} line={line} />)
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LogLineRow — tek satır render'ı ayrı bileşene taşındı (SRP)
// ---------------------------------------------------------------------------

const TAG_STYLES: Record<string, string> = {
  'MOTOR':      'tagEngine',
  'DNS':        'tagDns',
  'ADBLOCK':    'tagAdblock',
  'GÜVENLİK':  'tagSecurity',
  'GÜNCELLEME': 'tagUpdate',
  'SİSTEM':     'tagSystem',
  'HATA':       'tagError',
  'UYARI':      'tagWarn',
  'INFO':       'tagSystem',
  'WARN':       'tagWarn',
  'ERROR':      'tagError',
};

function getTagStyleKey(tag: string): string {
  return TAG_STYLES[tag.toUpperCase()] ?? 'tagGeneric';
}

function LogLineRow({ line }: { line: LogLine }) {
  const time = line.timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // [TAG] pattern — satır başındaki köşeli parantez içindeki etiketi al
  const tagMatch = line.content.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);

  if (tagMatch) {
    const tag = tagMatch[1];
    const rest = tagMatch[2];
    const tagKey = getTagStyleKey(tag);

    return (
      <div className={styles.logLine}>
        <span className={styles.timestamp}>{time}</span>
        <span className={`${styles.tag} ${styles[tagKey]}`}>{tag}</span>
        <span className={`${styles['content--' + line.level]} ${styles.message}`}>{rest}</span>
      </div>
    );
  }

  return (
    <div className={styles.logLine}>
      <span className={styles.timestamp}>{time}</span>
      <span className={`${styles['content--' + line.level]} ${styles.message}`}>{line.content}</span>
    </div>
  );
}
