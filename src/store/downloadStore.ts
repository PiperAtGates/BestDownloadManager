import { create } from 'zustand';
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
}

// Removed mock data

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  tasks: [],
  addTask: (task) => {
    invoke('start_download', { 
      taskId: task.id, 
      url: task.url, 
      destination: `${get().downloadLocation}\\${task.filename}` 
    }).catch(err => {
      console.error(err);
      alert(`Failed to start download: ${err}. Are you running in a regular web browser instead of the Tauri app?`);
    });
    set((state) => ({ tasks: [task, ...state.tasks] }));
  },
  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
  })),
  removeTask: (id) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== id)
  })),
  pauseTask: (id) => set((state) => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, status: 'paused', speedBytesPerSec: 0 } : t)
  })),
  resumeTask: (id) => set((state) => {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
      invoke('start_download', { 
        taskId: task.id, 
        url: task.url, 
        destination: `${get().downloadLocation}\\${task.filename}` 
      }).catch(err => {
        console.error(err);
        alert(`Failed to start download: ${err}. Are you running in a regular web browser instead of the Tauri app?`);
      });
    }
    return {
      tasks: state.tasks.map(t => t.id === id ? { ...t, status: 'queued' } : t)
    };
  }),
  autoCategorize: true,
  setAutoCategorize: (val) => set({ autoCategorize: val }),
  downloadLocation: 'C:\\Downloads',
  setDownloadLocation: (val) => set({ downloadLocation: val }),
}));
