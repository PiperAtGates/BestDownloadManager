import React, { useState } from 'react';
import { useDownloadStore } from '../store/downloadStore';
import { DownloadItem } from './DownloadItem';
import { Sidebar } from './Sidebar';
import { AddDownloadModal } from './AddDownloadModal';
import { Settings } from './Settings';
import { SchedulerModal } from './SchedulerModal';
import { PasswordManager } from './PasswordManager';
import { LogsModal } from './LogsModal';
import { Plus, Coffee } from 'lucide-react';
import styles from './Dashboard.module.css';

export const Dashboard: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
  const [isPasswordsOpen, setIsPasswordsOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const { tasks } = useDownloadStore();

  const q = searchQuery.trim().toLowerCase();
  const filteredTasks = tasks.filter((task) => {
    // Status / category filter (unchanged behaviour).
    if (activeFilter === 'downloading' && task.status !== 'downloading') return false;
    if (activeFilter === 'completed' && task.status !== 'completed') return false;
    if (activeFilter === 'queued' && task.status !== 'queued' && task.status !== 'paused') return false;
    if (['software', 'video', 'music', 'documents'].includes(activeFilter)) {
      if (task.category.toLowerCase() !== activeFilter) return false;
    }

    // Search filter (across URL + filename, case-insensitive).
    if (q) {
      const haystack = `${task.url} ${task.filename}`;
      if (!haystack.toLowerCase().includes(q)) return false;
    }

    return true;
  });

  return (
    <div className={styles.dashboardContainer}>
      <Sidebar
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenScheduler={() => setIsSchedulerOpen(true)}
        onOpenPasswords={() => setIsPasswordsOpen(true)}
        onOpenLogs={() => setIsLogsOpen(true)}
      />

      <main className={styles.mainContent}>
        <header className={styles.topbar}>
          <div className={styles.searchContainer}>
            <input
              type="text"
              placeholder="Search downloads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>


          <div style={{ display: 'flex', gap: '10px' }}>
            <a
              href="https://buymeacoffee.com/YOUR_USERNAME"
              target="_blank"
              rel="noreferrer"
              className="btn-icon"
              style={{ backgroundColor: '#ffdd00', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 15px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}
              title="Support the Project"
            >
              <Coffee size={18} style={{ marginRight: '8px' }} />
              Support
            </a>

            <button className={`btn-primary ${styles.addBtn}`} onClick={() => setIsModalOpen(true)}>
              <Plus size={18} />
              <span>New Download</span>
            </button>
          </div>
        </header>

        <div className={styles.contentArea}>
          <div className={styles.listHeader}>
            <h2>{activeFilter === 'all' ? 'All Downloads' : activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}</h2>
            <span className={styles.taskCount}>{filteredTasks.length} tasks</span>
          </div>

          <div className={styles.downloadList}>
            {filteredTasks.length > 0 ? (
              filteredTasks.map(task => (
                <DownloadItem key={task.id} task={task} />
              ))
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📂</div>
                <h3>No downloads found</h3>
                <p>Try adjusting your filters or adding a new download.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <AddDownloadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <SchedulerModal isOpen={isSchedulerOpen} onClose={() => setIsSchedulerOpen(false)} />
      <PasswordManager isOpen={isPasswordsOpen} onClose={() => setIsPasswordsOpen(false)} />
      <LogsModal isOpen={isLogsOpen} onClose={() => setIsLogsOpen(false)} />
    </div>
  );
};
