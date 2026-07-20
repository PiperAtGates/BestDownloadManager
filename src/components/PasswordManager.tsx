import React, { useState } from 'react';
import { X, Lock, Globe } from 'lucide-react';
import styles from './Settings.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const PasswordManager: React.FC<Props> = ({ isOpen, onClose }) => {
  const [domain, setDomain] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  // Credential storage is not yet implemented in the backend (no encryption key
  // material is plumbed in yet). The form is kept so the UI is ready, but
  // saving is disabled until localStorage/SQLite crypto is wired up.
  const handleSave = () => {
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={`glass-panel animate-fade-in ${styles.modal}`}>
        <div className={styles.header}>
          <h2><Lock size={20} style={{marginRight: '8px', verticalAlign: 'middle'}}/> Password Manager</h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <p style={{color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '13px'}}>
            Save login credentials for file hosts (e.g., premium accounts, HTTP Basic Auth).
          </p>

          <div style={{marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255,180,0,0.12)', border: '1px solid rgba(255,180,0,0.3)', color: 'var(--warning-color)', fontSize: '13px'}}>
            ⚠ Credential storage is not yet implemented — the backend has no
            encryption keying yet, so nothing is saved. This form is a placeholder
            until that lands.
          </div>

          <div className={styles.section}>
            <div className={styles.settingRow}>
              <label>Domain (e.g., example.com)</label>
              <div style={{display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', padding: '0 8px'}}>
                 <Globe size={16} color="var(--text-secondary)" />
                 <input 
                  type="text" 
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className={styles.input} 
                  style={{border: 'none', background: 'transparent'}}
                />
              </div>
            </div>
            <div className={styles.settingRow}>
              <label>Username</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={styles.input} 
              />
            </div>
            <div className={styles.settingRow}>
              <label>Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input} 
              />
            </div>
          </div>

          <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '24px', gap: '12px'}}>
            <button className={styles.btnCancel} onClick={onClose} style={{background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer'}}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled
              title="Credential storage is not yet implemented"
              style={{opacity: 0.5, cursor: 'not-allowed'}}
            >
              Save Credentials
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
