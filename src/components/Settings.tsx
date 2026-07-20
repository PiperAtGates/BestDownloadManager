import React from 'react';
import { X, Shield, Activity, HardDrive } from 'lucide-react';
import styles from './Settings.module.css';
import { useDownloadStore } from '../store/downloadStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const Settings: React.FC<Props> = ({ isOpen, onClose }) => {
  const { autoCategorize, setAutoCategorize, downloadLocation, setDownloadLocation } = useDownloadStore();
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
              <input type="number" defaultValue={5} min={1} max={20} className={styles.input} />
            </div>
            <div className={styles.settingRow}>
              <label>Max Connections Per File</label>
              <input type="number" defaultValue={16} min={1} max={32} className={styles.input} />
            </div>
          </div>

          <div className={styles.section}>
            <h3><Shield size={16}/> Proxy & Security</h3>
            <div className={styles.settingRow}>
              <label>Proxy Settings</label>
              <select className={styles.input}>
                <option>System Default</option>
                <option>No Proxy</option>
                <option>HTTP Proxy</option>
                <option>SOCKS4</option>
                <option>SOCKS5</option>
              </select>
            </div>
            <div className={styles.settingRow}>
              <label>Scan files after download (Windows Defender)</label>
              <input type="checkbox" defaultChecked style={{width: '18px', height: '18px'}} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
