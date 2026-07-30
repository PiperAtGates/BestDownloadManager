import React, { useState } from 'react';
import { X, Shield, Activity, HardDrive, Gauge, Clipboard } from 'lucide-react';
import styles from './Settings.module.css';
import { useDownloadStore } from '../store/downloadStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SPEED_PRESETS = [
  { label: 'Unlimited', bps: 0 },
  { label: '256 KB/s', bps: 256 * 1024 },
  { label: '512 KB/s', bps: 512 * 1024 },
  { label: '1 MB/s', bps: 1024 * 1024 },
  { label: '2 MB/s', bps: 2 * 1024 * 1024 },
  { label: '5 MB/s', bps: 5 * 1024 * 1024 },
  { label: '10 MB/s', bps: 10 * 1024 * 1024 },
  { label: '20 MB/s', bps: 20 * 1024 * 1024 },
  { label: '50 MB/s', bps: 50 * 1024 * 1024 },
];

function formatBps(bps: number): string {
  if (bps === 0) return 'Unlimited';
  if (bps >= 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(0)} MB/s`;
  return `${(bps / 1024).toFixed(0)} KB/s`;
}

export const Settings: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    autoCategorize,
    setAutoCategorize,
    downloadLocation,
    setDownloadLocation,
    maxConcurrent,
    setMaxConcurrent,
    speedLimitBps,
    setSpeedLimitBps,
    clipboardMonitor,
    setClipboardMonitor,
  } = useDownloadStore();

  const [customKbps, setCustomKbps] = useState('');

  if (!isOpen) return null;

  const handleSpeedPreset = (bps: number) => {
    setSpeedLimitBps(bps);
    setCustomKbps('');
  };

  const handleCustomKbps = (val: string) => {
    setCustomKbps(val);
    const n = parseFloat(val);
    if (!isNaN(n) && n >= 0) setSpeedLimitBps(Math.round(n * 1024));
  };

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
            <h3><Gauge size={16}/> Speed Limit</h3>
            <div className={styles.settingRow}>
              <label>Current limit</label>
              <span style={{ color: 'var(--primary-accent)', fontWeight: 600 }}>
                {formatBps(speedLimitBps)}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {SPEED_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handleSpeedPreset(p.bps)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid',
                    borderColor: speedLimitBps === p.bps ? 'var(--primary-accent)' : 'var(--surface-highlight)',
                    background: speedLimitBps === p.bps ? 'var(--primary-accent)' : 'transparent',
                    color: speedLimitBps === p.bps ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className={styles.settingRow} style={{ marginTop: '10px' }}>
              <label>Custom (KB/s)</label>
              <input
                type="number"
                min={0}
                value={customKbps}
                placeholder="e.g. 750"
                onChange={(e) => handleCustomKbps(e.target.value)}
                className={styles.input}
                style={{ width: '120px' }}
              />
            </div>
          </div>

          <div className={styles.section}>
            <h3><Clipboard size={16}/> Clipboard</h3>
            <div className={styles.settingRow}>
              <div>
                <label>Clipboard Monitoring</label>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  Show a popup when a download URL is copied
                </p>
              </div>
              <input
                type="checkbox"
                checked={clipboardMonitor}
                onChange={(e) => setClipboardMonitor(e.target.checked)}
                style={{width: '18px', height: '18px', flexShrink: 0}}
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
