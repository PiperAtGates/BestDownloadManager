import React from 'react';
import { DownloadTask, useDownloadStore } from '../store/downloadStore';
import { formatBytes, formatTime } from '../utils/formatters';
import { Play, Pause, Trash2, FileBox, Copy, FolderOpen, ExternalLink } from 'lucide-react';
import styles from './DownloadItem.module.css';

interface Props {
  task: DownloadTask;
}

export const DownloadItem: React.FC<Props> = ({ task }) => {
  const { pauseTask, resumeTask, removeTask, downloadLocation } = useDownloadStore();

  const progress = task.totalBytes > 0 
    ? (task.downloadedBytes / task.totalBytes) * 100 
    : 0;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(task.url);
  };

  const handleOpenFile = async () => {
    try {
      const { openPath } = await import('@tauri-apps/plugin-opener');
      const path = `${downloadLocation}\\${task.filename}`;
      await openPath(path);
    } catch (e) { console.error(e); }
  };

  const handleOpenFolder = async () => {
    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
      const path = `${downloadLocation}\\${task.filename}`;
      await revealItemInDir(path);
    } catch (e) { console.error(e); }
  };

  return (
    <div className={`glass-panel animate-fade-in ${styles.downloadItem}`}>
      <div className={styles.iconContainer}>
        <FileBox size={24} color="var(--primary-accent)" />
      </div>
      
      <div className={styles.contentContainer}>
        <div className={styles.header}>
          <h3 className={styles.filename} title={task.filename}>{task.filename}</h3>
          <span className={`${styles.statusBadge} ${styles[task.status]}`}>
            {task.status.toUpperCase()}
          </span>
        </div>

        <div className={styles.stats}>
          <span>{formatBytes(task.downloadedBytes)} / {formatBytes(task.totalBytes)}</span>
          {task.status === 'downloading' && (
            <>
              <span className={styles.separator}>•</span>
              <span className={styles.speed}>{formatBytes(task.speedBytesPerSec)}/s</span>
              <span className={styles.separator}>•</span>
              <span className={styles.eta}>{formatTime(task.etaSeconds)} remaining</span>
            </>
          )}
          {task.status === 'error' && task.errorMessage && (
            <>
              <span className={styles.separator}>•</span>
              <span className={styles.errorText} style={{ color: 'var(--danger-color)', fontSize: '0.8rem' }}>{task.errorMessage}</span>
            </>
          )}
        </div>

        <div className="progress-container">
          <div 
            className="progress-fill" 
            style={{ 
              width: `${progress}%`,
              backgroundColor: task.status === 'error' ? 'var(--danger-color)' : 
                               task.status === 'paused' ? 'var(--warning-color)' : 
                               task.status === 'completed' ? 'var(--success-color)' : 
                               'var(--primary-accent)'
            }} 
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button className="btn-icon" onClick={handleCopyUrl} title="Copy URL">
          <Copy size={18} />
        </button>
        {task.status === 'downloading' ? (
          <button className="btn-icon" onClick={() => pauseTask(task.id)} title="Pause">
            <Pause size={18} />
          </button>
        ) : task.status === 'completed' ? (
          <>
            <button className="btn-icon" onClick={handleOpenFile} title="Open File">
              <ExternalLink size={18} color="var(--primary-accent)" />
            </button>
            <button className="btn-icon" onClick={handleOpenFolder} title="Open Folder">
              <FolderOpen size={18} color="var(--primary-accent)" />
            </button>
          </>
        ) : (
          <button className="btn-icon" onClick={() => resumeTask(task.id)} title="Resume">
            <Play size={18} />
          </button>
        )}
        <button className="btn-icon" onClick={() => removeTask(task.id)} title="Remove">
          <Trash2 size={18} color="var(--danger-color)" />
        </button>
      </div>
    </div>
  );
};
