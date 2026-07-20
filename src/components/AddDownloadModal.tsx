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
  const { addTask, autoCategorize } = useDownloadStore();

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

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);

    if (autoCategorize) {
      const lowerUrl = newUrl.toLowerCase();
      if (lowerUrl.startsWith('magnet:')) {
        setCategory('Software'); // Or Other
      } else if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be') || lowerUrl.includes('vimeo.com')) {
        setCategory('Video');
      } else if (lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.mkv') || lowerUrl.endsWith('.avi')) {
        setCategory('Video');
      } else if (lowerUrl.endsWith('.mp3') || lowerUrl.endsWith('.wav') || lowerUrl.endsWith('.flac')) {
        setCategory('Music');
      } else if (lowerUrl.endsWith('.pdf') || lowerUrl.endsWith('.doc') || lowerUrl.endsWith('.docx') || lowerUrl.endsWith('.txt')) {
        setCategory('Documents');
      } else if (lowerUrl.endsWith('.zip') || lowerUrl.endsWith('.rar') || lowerUrl.endsWith('.7z') || lowerUrl.endsWith('.iso') || lowerUrl.endsWith('.exe')) {
        setCategory('Software');
      }
    }
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
                  onChange={handleUrlChange}
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
