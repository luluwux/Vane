import { LogViewer } from '../components/LogViewer/LogViewer';
import { useEngineStore } from '../store/engineStore';
import styles from './LogView.module.css';

export function LogView() {
  const { logs, clearLogs } = useEngineStore();

  return (
    <div className={styles.view}>
      <LogViewer logs={logs} onClear={clearLogs} />
    </div>
  );
}
