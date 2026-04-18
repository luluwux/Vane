import { useRef } from 'react';
import { HardDriveDownload, HardDriveUpload } from 'lucide-react';
import styles from '../../../views/AdvancedView.module.css';

interface ImportExportBarProps {
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  exportDisabled: boolean;
}

export function ImportExportBar({ onExport, onImport, exportDisabled }: ImportExportBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={styles.bottomBar}>
      <div className={styles.saveSection}>
        <button 
          className={styles.actionBtn} 
          onClick={onExport} 
          disabled={exportDisabled} 
          title="Export Profile"
        >
          <HardDriveDownload size={16} />
          <span>Export</span>
        </button>

        <button 
          className={styles.actionBtn} 
          onClick={() => fileInputRef.current?.click()} 
          title="Import Profile"
        >
          <HardDriveUpload size={16} />
          <span>Import</span>
        </button>

        <input 
          type="file" 
          accept=".json" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={(e) => {
            onImport(e);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }} 
        />
      </div>
    </div>
  );
}
