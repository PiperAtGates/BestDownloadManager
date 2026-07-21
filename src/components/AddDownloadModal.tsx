import React, { useState } from 'react';
import { X, Link, Folder, FileUp } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useDownloadStore } from '../store/downloadStore';
import styles from './AddDownloadModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AddDownloadModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [url, setUrl] = useState('');
  const [filename, setFilename] = useState('');
  const [category, setCategory] = useState('Software');
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const { addTask, autoCategorize } = useDownloadStore();

  if (!isOpen) return null;

  const sanitizeFilename = (name: string) => {
    return name.replace(/[<>:"/\\|?*]/g, '_');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    let finalFilename = filename.trim();
    if (!finalFilename) {
      finalFilename = url.split('/').pop() || 'download_file';
      if (finalFilename.includes('?')) finalFilename = finalFilename.split('?')[0];
      if (!finalFilename) finalFilename = 'unknown_file';
    }
    finalFilename = sanitizeFilename(finalFilename);

    addTask({
      id: crypto.randomUUID(),
      url,
      filename: finalFilename,
      totalBytes: 0,
      downloadedBytes: 0,
      speedBytesPerSec: 0,
      status: 'queued',
      category,
      etaSeconds: 0,
      createdAt: Date.now(),
      progress: 0,
    });

    setUrl('');
    setFilename('');
    onClose();
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);

    if (autoCategorize) {
      const lowerUrl = newUrl.toLowerCase();
      if (lowerUrl.startsWith('magnet:') || lowerUrl.endsWith('.torrent')) {
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

    if (newUrl.includes('youtube.com') || newUrl.includes('youtu.be')) {
      setIsFetchingInfo(true);
      invoke<string>('get_youtube_info', { url: newUrl })
        .then((title) => {
          setFilename(sanitizeFilename(title));
        })
        .catch((e) => console.error(e))
        .finally(() => setIsFetchingInfo(false));
    }
  };

  const handleBrowseTorrent = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Torrent', extensions: ['torrent'] }]
      });
      if (selected && typeof selected === 'string') {
        setUrl(selected);
        const name = selected.split('\\').pop()?.split('/').pop() || 'torrent_file';
        setFilename(name);
        if (autoCategorize) setCategory('Software');
      }
    } catch (e) {
      console.error(e);
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
                onClick={handleBrowseTorrent}
                style={{backgroundColor: 'var(--surface-highlight)', color: 'var(--text-primary)'}}
                title="Browse .torrent file"
              >
                <FileUp size={18} />
              </button>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label>Filename (Optional)</label>
            <div className={styles.inputWrapper}>
              <Folder size={18} className={styles.inputIcon} />
              <input 
                type="text" 
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder={isFetchingInfo ? "Fetching title..." : "Custom filename..."} 
                className={styles.input}
              />
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
