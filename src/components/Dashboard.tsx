import React, { useState } from 'react';
import { useDownloadStore } from '../store/downloadStore';
import { DownloadItem } from './DownloadItem';
import { Sidebar } from './Sidebar';
import { AddDownloadModal } from './AddDownloadModal';
import { Settings } from './Settings';
import { SchedulerModal } from './SchedulerModal';
import { PasswordManager } from './PasswordManager';
import { Plus } from 'lucide-react';
import styles from './Dashboard.module.css';

export const Dashboard: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
  const [isPasswordsOpen, setIsPasswordsOpen] = useState(false);
  const { tasks } = useDownloadStore();

  const filteredTasks = tasks.filter(task => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'downloading') return task.status === 'downloading';
    if (activeFilter === 'completed') return task.status === 'completed';
    if (activeFilter === 'queued') return task.status === 'queued' || task.status === 'paused';
    
    // Category filtering
    if (['software', 'video', 'music', 'documents'].includes(activeFilter)) {
      return task.category.toLowerCase() === activeFilter;
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
      />
      
      <main className={styles.mainContent}>
        <header className={styles.topbar}>
          <div className={styles.searchContainer}>
            <input 
              type="text" 
              placeholder="Search downloads..." 
              className={styles.searchInput}
            />
          </div>
          
          <button className={`btn-primary ${styles.addBtn}`} onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            <span>New Download</span>
          </button>
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
    </div>
  );
};
