import { create } from 'zustand';

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
}

interface DownloadStore {
  tasks: DownloadTask[];
  addTask: (task: DownloadTask) => void;
  updateTask: (id: string, updates: Partial<DownloadTask>) => void;
  removeTask: (id: string) => void;
  pauseTask: (id: string) => void;
  resumeTask: (id: string) => void;
}

// Mock initial state for UI development
const initialTasks: DownloadTask[] = [
  {
    id: '1',
    url: 'https://example.com/ubuntu-24.04-desktop-amd64.iso',
    filename: 'ubuntu-24.04-desktop-amd64.iso',
    totalBytes: 5 * 1024 * 1024 * 1024,
    downloadedBytes: 1.2 * 1024 * 1024 * 1024,
    speedBytesPerSec: 15 * 1024 * 1024,
    status: 'downloading',
    category: 'Software',
    etaSeconds: 253,
    createdAt: Date.now() - 100000,
  },
  {
    id: '2',
    url: 'magnet:?xt=urn:btih:...',
    filename: 'Blender 4.1.zip',
    totalBytes: 850 * 1024 * 1024,
    downloadedBytes: 850 * 1024 * 1024,
    speedBytesPerSec: 0,
    status: 'completed',
    category: 'Software',
    etaSeconds: 0,
    createdAt: Date.now() - 500000,
  },
  {
    id: '3',
    url: 'https://example.com/movie.mp4',
    filename: 'holiday_video_1080p.mp4',
    totalBytes: 2.1 * 1024 * 1024 * 1024,
    downloadedBytes: 0.5 * 1024 * 1024 * 1024,
    speedBytesPerSec: 0,
    status: 'paused',
    category: 'Video',
    etaSeconds: 0,
    createdAt: Date.now(),
  }
];

export const useDownloadStore = create<DownloadStore>((set) => ({
  tasks: initialTasks,
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
  })),
  removeTask: (id) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== id)
  })),
  pauseTask: (id) => set((state) => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, status: 'paused', speedBytesPerSec: 0 } : t)
  })),
  resumeTask: (id) => set((state) => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, status: 'queued' } : t)
  })),
}));
