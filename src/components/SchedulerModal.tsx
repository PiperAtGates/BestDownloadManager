import React, { useState } from 'react';
import { X, Clock, Calendar } from 'lucide-react';
import styles from './Settings.module.css'; // Reusing modal styles

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SchedulerModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [startTime, setStartTime] = useState('02:00');
  const [stopTime, setStopTime] = useState('08:00');

  if (!isOpen) return null;

  const handleSave = () => {
    // In a real implementation, send this to the Rust backend to setup Tokio Cron Jobs
    console.log(`Scheduled downloads between ${startTime} and ${stopTime}`);
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={`glass-panel animate-fade-in ${styles.modal}`}>
        <div className={styles.header}>
          <h2><Clock size={20} style={{marginRight: '8px', verticalAlign: 'middle'}}/> Download Scheduler</h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <p style={{color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '13px'}}>
            Set a time window for background downloads to run (e.g., during off-peak hours).
          </p>

          <div className={styles.section}>
            <div className={styles.settingRow}>
              <label>Start Time</label>
              <input 
                type="time" 
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={styles.input} 
              />
            </div>
            <div className={styles.settingRow}>
              <label>Stop Time</label>
              <input 
                type="time" 
                value={stopTime}
                onChange={(e) => setStopTime(e.target.value)}
                className={styles.input} 
              />
            </div>
          </div>

          <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '24px', gap: '12px'}}>
            <button className={styles.btnCancel} onClick={onClose} style={{background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer'}}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave}>
              Save Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
