import React, { useEffect, useState } from 'react';
import { X, RefreshCw, Terminal } from 'lucide-react';
import styles from './Settings.module.css'; // Reusing settings overlay/modal styles

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const LogsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { invoke } = await import('@tauri-apps/api/core');
      const data = await invoke<string[]>('get_logs');
      setLogs(data);
    } catch (e) {
      console.error("Failed to fetch logs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={`glass-panel animate-fade-in ${styles.modal}`} style={{ maxWidth: '800px' }}>
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={20} />
            <h2>Application Logs</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-icon" onClick={fetchLogs} title="Refresh Logs" disabled={loading}>
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button className="btn-icon" onClick={onClose} title="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className={styles.content}>
          <div style={{ 
            backgroundColor: 'rgba(0,0,0,0.4)', 
            padding: '16px', 
            borderRadius: '8px', 
            minHeight: '300px', 
            maxHeight: '500px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px',
            whiteSpace: 'pre-wrap'
          }}>
            {logs.length === 0 ? (
              <span style={{ color: 'gray' }}>No logs available.</span>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} style={{ marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
