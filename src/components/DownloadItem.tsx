import React from 'react';
import { DownloadTask, useDownloadStore } from '../store/downloadStore';
import { formatBytes, formatTime } from '../utils/formatters';
import { Play, Pause, Trash2, RotateCw, FileBox } from 'lucide-react';
import styles from './DownloadItem.module.css';

interface Props {
  task: DownloadTask;
}

export const DownloadItem: React.FC<Props> = ({ task }) => {
  const { pauseTask, resumeTask, removeTask } = useDownloadStore();

  const progress = task.totalBytes > 0 
    ? (task.downloadedBytes / task.totalBytes) * 100 
    : 0;

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
        {task.status === 'downloading' ? (
          <button className="btn-icon" onClick={() => pauseTask(task.id)} title="Pause">
            <Pause size={18} />
          </button>
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
