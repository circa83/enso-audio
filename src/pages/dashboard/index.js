// src/pages/dashboard/index.js
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useAuth } from '../../contexts/AuthContext';
import withAuth from '../../components/auth/ProtectedRoute';
import DashboardLayout from '../../components/layout/DashboardLayout';
import styles from '../../styles/pages/Dashboard.module.css';

const Dashboard = () => {
  const { user } = useAuth();
  const { data: session } = useSession();
  const [userStats, setUserStats] = useState({
    sessionsCompleted: 0,
    activeClients: 0,
    totalSessionTime: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch user stats from API
  useEffect(() => {
    const fetchUserStats = async () => {
      if (session) {
        try {
          setIsLoading(true);
          const response = await fetch('/api/users/stats');
          
          if (!response.ok) {
            throw new Error('Failed to fetch user stats');
          }
          
          const data = await response.json();
          setUserStats(data);
        } catch (err) {
          console.error('Error fetching user stats:', err);
          setError('Could not load your statistics');
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    fetchUserStats();
  }, [session]);
  
  // Format milliseconds to HH:MM:SS
  const formatTime = (ms) => {
    if (!ms) return '00:00:00';
    
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <DashboardLayout activePage="dashboard">
      <Head>
        <title>Dashboard | Ensō Audio</title>
      </Head>
      
      <div className={styles.dashboardHeader}>
        <h1 className={styles.welcomeTitle}>
          Welcome, {user?.name || 'Therapist'}
        </h1>
        <p className={styles.welcomeSubtitle}>
          Manage your therapeutic sessions and audio library
        </p>
      </div>
      
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            {isLoading ? '...' : userStats.sessionsCompleted}
          </div>
          <div className={styles.statLabel}>Sessions Completed</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            {isLoading ? '...' : userStats.activeClients}
          </div>
          <div className={styles.statLabel}>Active Clients</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            {isLoading ? '...' : formatTime(userStats.totalSessionTime)}
          </div>
          <div className={styles.statLabel}>Total Session Time</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statValue}>8</div>
          <div className={styles.statLabel}>Audio Files</div>
        </div>
      </div>
      
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}
      
      <div className={styles.quickActions}>
        <h2 className={styles.sectionTitle}>Quick Actions</h2>
        
        <div className={styles.actionGrid}>
          <Link href="/dashboard/player" className={styles.actionCard}>
            <div className={styles.actionIcon}>▶</div>
            <div className={styles.actionLabel}>Start Session</div>
          </Link>
          
          <Link href="/dashboard/library" className={styles.actionCard}>
            <div className={styles.actionIcon}>🎵</div>
            <div className={styles.actionLabel}>Audio Library</div>
          </Link>
          
          <Link href="/dashboard/settings" className={styles.actionCard}>
            <div className={styles.actionIcon}>⚙️</div>
            <div className={styles.actionLabel}>Settings</div>
          </Link>
          
          <Link href="/dashboard/help" className={styles.actionCard}>
            <div className={styles.actionIcon}>?</div>
            <div className={styles.actionLabel}>Help Guide</div>
          </Link>
        </div>
      </div>
      
      <div className={styles.recentSessions}>
        <h2 className={styles.sectionTitle}>Recent Sessions</h2>
        
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📋</div>
          <div className={styles.emptyTitle}>No Recent Sessions</div>
          <div className={styles.emptyDescription}>
            Your recent therapy sessions will appear here once you start recording them.
          </div>
          <Link href="/dashboard/player" className={styles.emptyButton}>
            Start Your First Session
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default withAuth(Dashboard);