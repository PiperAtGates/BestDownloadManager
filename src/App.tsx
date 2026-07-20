import { useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useDownloadStore, DownloadTask } from './store/downloadStore';

function App() {
  useEffect(() => {
    let active = true;
    let unlistenProgress: (() => void) | undefined;
    let unlistenIntercept: (() => void) | undefined;

    // Push the persisted concurrent-downloads limit to the backend so the
    // queue semaphore matches what's shown in Settings.
    invoke('set_max_concurrent', { n: useDownloadStore.getState().maxConcurrent }).catch(
      (e) => console.error('Failed to sync max_concurrent on startup:', e),
    );

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
      if (!active) {
        fn();
      } else {
        unlistenProgress = fn;
      }
    }).catch(console.error);

    // Auto-add downloads that the browser extension intercepts and forwards.
    listen('browser_download_intercepted', (event: any) => {
      const { url, filename } = event.payload ?? {};
      if (!url) return;
      const store = useDownloadStore.getState();
      // Don't add a duplicate of a still-active download.
      const dupe = store.tasks.some(
        (t) => t.url === url &&
          t.status !== 'completed' &&
          t.status !== 'error',
      );
      if (dupe) return;

      const sanitize = (name: string) =>
        name.replace(/[<>:"/\\|?*]/g, '_');
      let finalFilename = sanitize(filename || '').trim();
      if (!finalFilename) {
        const fromUrl = url.split('/').pop()?.split('?')[0] || 'download_file';
        finalFilename = sanitize(fromUrl) || 'download_file';
      }

      store.addTask({
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
      if (!active) {
        fn();
      } else {
        unlistenIntercept = fn;
      }
    }).catch(console.error);

    return () => {
      active = false;
      if (unlistenProgress) unlistenProgress();
      if (unlistenIntercept) unlistenIntercept();
    };
  }, []);

  return (
    <Dashboard />
  );
}

export default App;
