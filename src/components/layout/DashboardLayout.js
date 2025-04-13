// src/components/layout/DashboardLayout.js
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../styles/components/DashboardLayout.module.css';

const DashboardLayout = ({ children, activePage }) => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const handleLogout = async () => {
    await logout();
  };
  
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  
  return (
    <div className={styles.dashboardContainer}>
      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <h1 className={styles.sidebarTitle}>Ensō Audio</h1>
          <button className={styles.closeMenuButton} onClick={toggleMenu}>×</button>
        </div>
        
        {user && (
          <div className={styles.userInfo}>
            <div className={styles.userInitials}>
              {user.name && user.name.charAt(0).toUpperCase()}
            </div>
            <div className={styles.userName}>{user.name}</div>
            <div className={styles.userRole}>{user.role}</div>
          </div>
        )}
        
        <nav className={styles.navigation}>
        <Link href="/ambient-archive" className={`${styles.navLink} ${activePage === 'ambient-archive' ? styles.active : ''}`}>
  Ambient Archive
</Link>
<Link href="/dashboard/player" className={`${styles.navLink} ${activePage === 'player' ? styles.active : ''}`}>
  Audio Player
</Link>
          {/* <Link href="/dashboard/sessions" className={`${styles.navLink} ${activePage === 'sessions' ? styles.active : ''}`}>
            Sessions
          </Link>
          <Link href="/dashboard/library" className={`${styles.navLink} ${activePage === 'library' ? styles.active : ''}`}>
            Audio Library
          </Link> 
          <Link href="/dashboard/settings" className={`${styles.navLink} ${activePage === 'settings' ? styles.active : ''}`}>
            Settings
          </Link> */}
        </nav>
        
        <div className={styles.sidebarFooter}>
          <button className={styles.logoutButton} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>
      
      {/* Main content */}
      <main className={styles.mainContent}>
        <div className={styles.topBar}>
          <button className={styles.menuButton} onClick={toggleMenu}>
            Menu
          </button>
          
          <div className={styles.topBarTitle}>
            {activePage && activePage.charAt(0).toUpperCase() + activePage.slice(1)}
          </div>
          
          <div className={styles.topBarUser}>
            {user && (
              <div className={styles.userDropdown}>
                <span className={styles.userInitialsSmall}>
                  {user.name && user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className={styles.content}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;