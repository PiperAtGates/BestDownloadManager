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

export interface SpeedPoint {
  timestamp: number;
  speedBytesPerSec: number;
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
  // Speed limiter (0 = unlimited, stored in bytes/sec)
  speedLimitBps: number;
  setSpeedLimitBps: (bps: number) => void;
  // Clipboard monitoring toggle
  clipboardMonitor: boolean;
  setClipboardMonitor: (val: boolean) => void;
  // Rolling speed history for the graph (not persisted, last 60s)
  speedHistory: SpeedPoint[];
  recordSpeedSnapshot: () => void;
}

const CATEGORY_FOLDERS: Record<string, string> = {
  Videos: 'Videos',
  Video: 'Videos',
  Music: 'Music',
  Software: 'Software',
  Documents: 'Documents',
  Archives: 'Archives',
  Other: 'Other',
};

export const getDestinationPath = (dir: string, filename: string, category: string) => {
  const cleanDir = dir.replace(/[/\\]+$/, '');
  const folder = CATEGORY_FOLDERS[category] ?? 'Other';
  return `${cleanDir}\\${folder}\\${filename}`;
};

const isBackendAvailable = () => {
  try {
    return !!window && '__TAURI_INTERNALS__' in window;
  } catch {
    return false;
  }
};

const SPEED_HISTORY_WINDOW_MS = 60_000;

export const useDownloadStore = create<DownloadStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      addTask: (task) => {
        invoke('start_download', {
          taskId: task.id,
          url: task.url,
          destination: getDestinationPath(get().downloadLocation, task.filename, task.category),
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
                task.category,
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
      speedLimitBps: 0,
      setSpeedLimitBps: (bps) => {
        const val = Math.max(0, Math.floor(bps));
        set({ speedLimitBps: val });
        invoke('set_speed_limit', { bytesPerSec: val }).catch((err) =>
          console.error('Failed to set speed limit:', err),
        );
      },
      clipboardMonitor: false,
      setClipboardMonitor: (val) => {
        set({ clipboardMonitor: val });
        invoke('set_clipboard_monitoring', { enabled: val }).catch((err) =>
          console.error('Failed to toggle clipboard monitoring:', err),
        );
      },
      speedHistory: [],
      recordSpeedSnapshot: () =>
        set((state) => {
          const now = Date.now();
          const totalSpeed = state.tasks
            .filter((t) => t.status === 'downloading')
            .reduce((sum, t) => sum + t.speedBytesPerSec, 0);
          const point: SpeedPoint = { timestamp: now, speedBytesPerSec: totalSpeed };
          const cutoff = now - SPEED_HISTORY_WINDOW_MS;
          const pruned = state.speedHistory
            .filter((p) => p.timestamp > cutoff)
            .concat(point);
          return { speedHistory: pruned };
        }),
    }),
    {
      name: 'vanguard-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        autoCategorize: s.autoCategorize,
        downloadLocation: s.downloadLocation,
        maxConcurrent: s.maxConcurrent,
        speedLimitBps: s.speedLimitBps,
        clipboardMonitor: s.clipboardMonitor,
      }),
    },
  ),
);
