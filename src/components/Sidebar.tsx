import React from 'react';
import { DownloadCloud, CheckCircle2, Clock, Settings, LayoutDashboard, Folder, Lock, Calendar } from 'lucide-react';
import styles from './Sidebar.module.css';

interface Props {
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
  onOpenSettings: () => void;
  onOpenScheduler: () => void;
  onOpenPasswords: () => void;
}

export const Sidebar: React.FC<Props> = ({ activeFilter, setActiveFilter, onOpenSettings, onOpenScheduler, onOpenPasswords }) => {
  const menuItems = [
    { id: 'all', label: 'All Downloads', icon: LayoutDashboard },
    { id: 'downloading', label: 'Downloading', icon: DownloadCloud },
    { id: 'completed', label: 'Completed', icon: CheckCircle2 },
    { id: 'queued', label: 'Queued', icon: Clock },
  ];

  const categories = [
    { id: 'software', label: 'Software' },
    { id: 'video', label: 'Video' },
    { id: 'music', label: 'Music' },
    { id: 'documents', label: 'Documents' },
  ];

  return (
    <div className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.logo}>
          <DownloadCloud size={24} color="#fff" />
        </div>
        <h2>Best Download Manager</h2>
      </div>

      <nav className={styles.navGroup}>
        <h3 className={styles.navTitle}>Status</h3>
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.navItem} ${activeFilter === item.id ? styles.active : ''}`}
            onClick={() => setActiveFilter(item.id)}
          >
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </nav>

      <nav className={styles.navGroup}>
        <h3 className={styles.navTitle}>Categories</h3>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`${styles.navItem} ${activeFilter === cat.id ? styles.active : ''}`}
            onClick={() => setActiveFilter(cat.id)}
          >
            <Folder size={18} />
            {cat.label}
          </button>
        ))}
      </nav>

      <div className={styles.spacer} />

      <nav className={styles.navGroup}>
        <button className={styles.navItem} onClick={onOpenScheduler}>
          <Calendar size={18} />
          Schedule
        </button>
        <button className={styles.navItem} onClick={onOpenPasswords}>
          <Lock size={18} />
          Passwords
        </button>
        <button className={styles.navItem} onClick={onOpenSettings}>
          <Settings size={18} />
          Settings
        </button>
      </nav>
    </div>
  );
};
