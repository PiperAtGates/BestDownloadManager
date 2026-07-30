import { useEffect, useRef, useCallback, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { ClipboardPopup } from './components/ClipboardPopup';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useDownloadStore, DownloadTask } from './store/downloadStore';

function App() {
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [pendingClipUrl, setPendingClipUrl] = useState<string | null>(null);
  const speedSnapshotRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleAddFromClipboard = useCallback((url: string) => {
    setClipboardUrl(null);
    setPendingClipUrl(url);
  }, []);

  const handleDismissClipboard = useCallback(() => setClipboardUrl(null), []);

  useEffect(() => {
    let active = true;
    let unlistenProgress: (() => void) | undefined;
    let unlistenIntercept: (() => void) | undefined;
    let unlistenClipboard: (() => void) | undefined;

    const store = useDownloadStore.getState();

    // Sync persisted settings to backend on startup
    invoke('set_max_concurrent', { n: store.maxConcurrent }).catch(
      (e) => console.error('Failed to sync max_concurrent on startup:', e),
    );
    invoke('set_speed_limit', { bytesPerSec: store.speedLimitBps }).catch(
      (e) => console.error('Failed to sync speed_limit on startup:', e),
    );
    invoke('set_clipboard_monitoring', { enabled: store.clipboardMonitor }).catch(
      (e) => console.error('Failed to sync clipboard_monitoring on startup:', e),
    );

    // Rolling speed history — snapshot every 500ms
    speedSnapshotRef.current = setInterval(() => {
      useDownloadStore.getState().recordSpeedSnapshot();
    }, 500);

    listen('download_progress', (event: any) => {
      const {
        taskId,
        totalBytes,
        downloadedBytes,
        speedBytesPerSec,
        status,
        errorMessage,
        filename,
      } = event.payload;
      const updates: Partial<DownloadTask> = {
        totalBytes,
        downloadedBytes,
        speedBytesPerSec,
        status,
        errorMessage,
        etaSeconds:
          speedBytesPerSec > 0
            ? Math.max(0, (totalBytes - downloadedBytes) / speedBytesPerSec)
            : 0,
      };
      if (filename) updates.filename = filename;
      useDownloadStore.getState().updateTask(taskId, updates);
    }).then((fn) => {
      if (!active) fn();
      else unlistenProgress = fn;
    }).catch(console.error);

    // Auto-add downloads forwarded by the browser extension
    listen('browser_download_intercepted', (event: any) => {
      const { url, filename } = event.payload ?? {};
      if (!url) return;
      const s = useDownloadStore.getState();
      const dupe = s.tasks.some(
        (t) => t.url === url && t.status !== 'completed' && t.status !== 'error',
      );
      if (dupe) return;

      const sanitize = (name: string) => name.replace(/[<>:"/\\|?*]/g, '_');
      let finalFilename = sanitize(filename || '').trim();
      if (!finalFilename) {
        const fromUrl = url.split('/').pop()?.split('?')[0] || 'download_file';
        finalFilename = sanitize(fromUrl) || 'download_file';
      }

      s.addTask({
        id: crypto.randomUUID(),
        url,
        filename: finalFilename,
        totalBytes: 0,
        downloadedBytes: 0,
        speedBytesPerSec: 0,
        status: 'queued',
        category: 'Other',
        etaSeconds: 0,
        createdAt: Date.now(),
        progress: 0,
      });
    }).then((fn) => {
      if (!active) fn();
      else unlistenIntercept = fn;
    }).catch(console.error);

    // Clipboard monitoring events from Rust backend
    listen('clipboard_url_detected', (event: any) => {
      const { url } = event.payload ?? {};
      if (!url) return;
      setClipboardUrl(url);
    }).then((fn) => {
      if (!active) fn();
      else unlistenClipboard = fn;
    }).catch(console.error);

    return () => {
      active = false;
      if (unlistenProgress) unlistenProgress();
      if (unlistenIntercept) unlistenIntercept();
      if (unlistenClipboard) unlistenClipboard();
      if (speedSnapshotRef.current) clearInterval(speedSnapshotRef.current);
    };
  }, []);

  return (
    <>
      <Dashboard pendingClipUrl={pendingClipUrl} onPendingClipUrlConsumed={() => setPendingClipUrl(null)} />
      {clipboardUrl && (
        <ClipboardPopup
          url={clipboardUrl}
          onAddDownload={handleAddFromClipboard}
          onDismiss={handleDismissClipboard}
        />
      )}
    </>
  );
}

export default App;
