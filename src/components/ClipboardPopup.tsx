import React, { useEffect, useRef } from 'react';
import { Download, X, Link } from 'lucide-react';
import styles from './ClipboardPopup.module.css';

interface Props {
  url: string;
  onAddDownload: (url: string) => void;
  onDismiss: () => void;
}

export const ClipboardPopup: React.FC<Props> = ({ url, onAddDownload, onDismiss }) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 8000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [url, onDismiss]);

  const displayUrl = url.length > 60 ? url.slice(0, 57) + '…' : url;

  return (
    <div className={`glass-panel animate-fade-in ${styles.popup}`}>
      <div className={styles.iconRow}>
        <Link size={16} color="var(--primary-accent)" />
        <span className={styles.label}>URL detected in clipboard</span>
        <button className="btn-icon" onClick={onDismiss} style={{ marginLeft: 'auto' }}>
          <X size={14} />
        </button>
      </div>
      <p className={styles.urlText} title={url}>{displayUrl}</p>
      <div className={styles.actions}>
        <button className={styles.btnDismiss} onClick={onDismiss}>
          Dismiss
        </button>
        <button className="btn-primary" onClick={() => onAddDownload(url)} style={{ fontSize: '13px', padding: '6px 14px' }}>
          <Download size={14} style={{ marginRight: '6px' }} />
          Add Download
        </button>
      </div>
    </div>
  );
};
