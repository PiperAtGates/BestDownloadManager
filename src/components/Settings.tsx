import React from 'react';
import { X, Shield, Activity, HardDrive } from 'lucide-react';
import styles from './Settings.module.css';
import { useDownloadStore } from '../store/downloadStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const Settings: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    autoCategorize,
    setAutoCategorize,
    downloadLocation,
    setDownloadLocation,
    maxConcurrent,
    setMaxConcurrent,
  } = useDownloadStore();
  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={`glass-panel animate-fade-in ${styles.modal}`}>
        <div className={styles.header}>
          <h2>Settings</h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.section}>
            <h3><HardDrive size={16}/> General</h3>
            <div className={styles.settingRow}>
              <label>Default Download Location</label>
              <input
                type="text"
                value={downloadLocation}
                onChange={(e) => setDownloadLocation(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.settingRow}>
              <label>Auto-Categorize Downloads</label>
              <input
                type="checkbox"
                checked={autoCategorize}
                onChange={(e) => setAutoCategorize(e.target.checked)}
                style={{width: '18px', height: '18px'}}
              />
            </div>
          </div>

          <div className={styles.section}>
            <h3><Activity size={16}/> Connections</h3>
            <div className={styles.settingRow}>
              <label>Max Concurrent Downloads</label>
              <input
                type="number"
                value={maxConcurrent}
                min={1}
                max={20}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (!isNaN(n)) setMaxConcurrent(n);
                }}
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.section}>
            <h3><Shield size={16}/> System Integration</h3>
            <div className={styles.settingRow}>
              <label>Default Torrent Client</label>
              <button
                className="btn-primary"
                onClick={async () => {
                  try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    await invoke('set_default_torrent_client');
                    alert("Successfully set Vanguard as the default torrent client.");
                  } catch (e) {
                    alert("Failed to set default client: " + e);
                  }
                }}
              >
                Set as Default
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
