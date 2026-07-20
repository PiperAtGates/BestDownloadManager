import React, { useState } from 'react';
import { X, Link, Folder, Search } from 'lucide-react';
import { useDownloadStore } from '../store/downloadStore';
import styles from './AddDownloadModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AddDownloadModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('Software');
  const { addTask } = useDownloadStore();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    let filename = url.split('/').pop() || 'download_file';
    if (filename.includes('?')) filename = filename.split('?')[0];
    if (!filename) filename = 'unknown_file';

    addTask({
      id: crypto.randomUUID(),
      url,
      filename,
      totalBytes: 0,
      downloadedBytes: 0,
      speedBytesPerSec: 0,
      status: 'queued',
      category,
      etaSeconds: 0,
      createdAt: Date.now(),
    });

    setUrl('');
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={`glass-panel animate-fade-in ${styles.modal}`}>
        <div className={styles.header}>
          <h2>Add New Download</h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>URL or Magnet Link</label>
            <div style={{display: 'flex', gap: '8px'}}>
              <div className={styles.inputWrapper} style={{flexGrow: 1}}>
                <Link size={18} className={styles.inputIcon} />
                <input 
                  type="text" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://... or magnet:?xt=..." 
                  className={styles.input}
                  autoFocus
                />
              </div>
              <button 
                type="button" 
                className="btn-icon" 
                style={{backgroundColor: 'var(--surface-highlight)', color: 'var(--text-primary)'}}
                title="Sniff Media from URL (yt-dlp)"
              >
                <Search size={18} />
              </button>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label>Category</label>
            <div className={styles.inputWrapper}>
              <Folder size={18} className={styles.inputIcon} />
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                className={styles.input}
              >
                <option value="Software">Software</option>
                <option value="Video">Video</option>
                <option value="Music">Music</option>
                <option value="Documents">Documents</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!url.trim()}>
              Download Now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
