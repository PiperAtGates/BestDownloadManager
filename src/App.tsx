import { useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { listen } from '@tauri-apps/api/event';
import { useDownloadStore } from './store/downloadStore';

function App() {
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen('download_progress', (event: any) => {
        const { taskId, totalBytes, downloadedBytes, speedBytesPerSec, status, errorMessage } = event.payload;
        useDownloadStore.getState().updateTask(taskId, {
          totalBytes,
          downloadedBytes,
          speedBytesPerSec,
          status,
          errorMessage,
          etaSeconds: speedBytesPerSec > 0 ? (totalBytes - downloadedBytes) / speedBytesPerSec : 0
        });
      });
      return unlisten;
    };

    let unlistenFn: (() => void) | undefined;
    setupListener().then(fn => unlistenFn = fn).catch(console.error);

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  return (
    <Dashboard />
  );
}

export default App;
