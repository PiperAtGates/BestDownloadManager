import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

export type DownloadStatus = 'downloading' | 'paused' | 'completed' | 'error' | 'queued';

export interface DownloadTask {
  id: string;
  url: string;
  filename: string;
  totalBytes: number;
  downloadedBytes: number;
  speedBytesPerSec: number;
  status: DownloadStatus;
  category: string;
  etaSeconds: number;
  createdAt: number;
  errorMessage?: string;
  progress: number;
}

interface DownloadStore {
  tasks: DownloadTask[];
  addTask: (task: DownloadTask) => void;
  updateTask: (id: string, updates: Partial<DownloadTask>) => void;
  removeTask: (id: string) => void;
  pauseTask: (id: string) => void;
  resumeTask: (id: string) => void;
  autoCategorize: boolean;
  setAutoCategorize: (val: boolean) => void;
  downloadLocation: string;
  setDownloadLocation: (path: string) => void;
  maxConcurrent: number;
  setMaxConcurrent: (n: number) => void;
}

const getDestinationPath = (dir: string, filename: string) => {
  const cleanDir = dir.replace(/[/\\]+$/, '');
  return `${cleanDir}\\${filename}`;
};

const isBackendAvailable = () => {
  // invoke() throws immediately (no Tauri IPC bridge) when running in a plain
  // browser tab instead of the Tauri webview. Used to give a clearer message.
  try {
    return !!window && '__TAURI_INTERNALS__' in window;
  } catch {
    return false;
  }
};

export const useDownloadStore = create<DownloadStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      addTask: (task) => {
        invoke('start_download', {
          taskId: task.id,
          url: task.url,
          destination: getDestinationPath(get().downloadLocation, task.filename),
        }).catch((err) => {
          console.error(err);
          if (!isBackendAvailable()) {
            alert(
              'Failed to start download: the backend is not reachable. Run this app with "npm run tauri dev", not in a plain browser tab.',
            );
          } else {
            alert(`Failed to start download: ${err}`);
          }
        });
        set((state) => ({ tasks: [task, ...state.tasks] }));
      },
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      removeTask: (id) => {
        // Only ask the backend to cancel the download if it's still active —
        // pausing a completed/errored task would just warn in the console.
        const task = get().tasks.find((t) => t.id === id);
        const active =
          task &&
          (task.status === 'downloading' ||
            task.status === 'paused' ||
            task.status === 'queued');
        if (active) {
          invoke('pause_download', { taskId: id }).catch(console.error);
        }
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        }));
      },
      pauseTask: (id) => {
        invoke('pause_download', { taskId: id }).catch((err) => {
          console.error('Failed to pause download task in backend:', err);
        });
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? { ...t, status: 'paused', speedBytesPerSec: 0 }
              : t,
          ),
        }));
      },
      resumeTask: (id) =>
        set((state) => {
          const task = state.tasks.find((t) => t.id === id);
          if (task) {
            invoke('start_download', {
              taskId: task.id,
              url: task.url,
              destination: getDestinationPath(
                get().downloadLocation,
                task.filename,
              ),
            }).catch((err) => {
              console.error(err);
              if (!isBackendAvailable()) {
                alert(
                  'Failed to resume download: the backend is not reachable. Run this app with "npm run tauri dev".',
                );
              } else {
                alert(`Failed to resume download: ${err}`);
              }
            });
          }
          return {
            tasks: state.tasks.map((t) =>
              t.id === id ? { ...t, status: 'queued' } : t,
            ),
          };
        }),
      autoCategorize: true,
      setAutoCategorize: (val) => set({ autoCategorize: val }),
      downloadLocation: 'C:\\Downloads',
      setDownloadLocation: (val) => set({ downloadLocation: val }),
      maxConcurrent: 5,
      setMaxConcurrent: (n) => {
        const clamped = Math.max(1, Math.min(20, Math.floor(n)));
        set({ maxConcurrent: clamped });
        invoke('set_max_concurrent', { n: clamped }).catch((err) =>
          console.error('Failed to set max concurrent downloads:', err),
        );
      },
    }),
    {
      name: 'vanguard-settings',
      storage: createJSONStorage(() => localStorage),
      // Persist only the durable settings — never the live task list.
      partialize: (s) => ({
        autoCategorize: s.autoCategorize,
        downloadLocation: s.downloadLocation,
        maxConcurrent: s.maxConcurrent,
      }),
    },
  ),
);
