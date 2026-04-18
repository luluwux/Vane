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

function LogLineRow({ line }: { line: LogLine }) {
  const time = line.timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className={styles.logLine}>
      <span className={styles.timestamp}>{time}</span>
      <span className={`${styles['content--' + line.level]}`}>{line.content}</span>
    </div>
  );
}
