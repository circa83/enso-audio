// src/pages/dashboard/settings.js
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import withAuth from '../../components/auth/ProtectedRoute';
import DashboardLayout from '../../components/layout/DashboardLayout';
import styles from '../../styles/pages/Settings.module.css';

const Settings = () => {
  const { data: session } = useSession();
  
  // Form states
  const [generalForm, setGeneralForm] = useState({
    name: '',
    email: '',
  });
  
  const [profileForm, setProfileForm] = useState({
    title: '',
    bio: '',
    specialties: '',
    organization: '',
  });
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Fetch user profile on load
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (session) {
        try {
          setIsLoading(true);
          const response = await fetch('/api/users/profile');
          
          if (!response.ok) {
            throw new Error('Failed to fetch user profile');
          }
          
          const user = await response.json();
          
          // Set general form data
          setGeneralForm({
            name: user.name || '',
            email: user.email || '',
          });
          
          // Set profile form data
          setProfileForm({
            title: user.profile?.title || '',
            bio: user.profile?.bio || '',
            specialties: user.profile?.specialties?.join(', ') || '',
            organization: user.profile?.organization || '',
          });
          
        } catch (err) {
          console.error('Error fetching user profile:', err);
          setError('Could not load your profile');
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    fetchUserProfile();
  }, [session]);
  
  // Handle general form changes
  const handleGeneralChange = (e) => {
    const { name, value } = e.target;
    setGeneralForm(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle profile form changes
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle password form changes
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle general form submission
  const handleGeneralSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);
      
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: generalForm.name,
          email: generalForm.email,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update profile');
      }
      
      setSuccess('Profile updated successfully');
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.message || 'An error occurred while updating your profile');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle profile form submission
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);
      
      // Process specialties into array
      const specialtiesArray = profileForm.specialties
        .split(',')
        .map(item => item.trim())
        .filter(item => item);
      
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile: {
            title: profileForm.title,
            bio: profileForm.bio,
            specialties: specialtiesArray,
            organization: profileForm.organization,
          },
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update professional profile');
      }
      
      setSuccess('Professional profile updated successfully');
    } catch (err) {
      console.error('Error updating professional profile:', err);
      setError(err.message || 'An error occurred while updating your professional profile');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle password form submission
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Reset states
      setIsSaving(true);
      setError(null);
      setSuccess(null);
      
      // Validate passwords match
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error('New passwords do not match');
      }
      
      // Validate password length
      if (passwordForm.newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }
      
      const response = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to change password');
      }
      
      // Reset password form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      
      setSuccess('Password changed successfully');
    } catch (err) {
      console.error('Error changing password:', err);
      setError(err.message || 'An error occurred while changing your password');
    } finally {
      setIsSaving(false);
    }
  };
  
  if (isLoading) {
    return (
      <DashboardLayout activePage="settings">
        <div className={styles.loadingContainer}>
          <p>Loading your profile...</p>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout activePage="settings">
      <Head>
        <title>Settings | Ensō Audio</title>
      </Head>
      
      <div className={styles.settingsContainer}>
        <h1 className={styles.pageTitle}>Account Settings</h1>
        
        {error && (
          <div className={styles.errorMessage}>{error}</div>
        )}
        
        {success && (
          <div className={styles.successMessage}>{success}</div>
        )}
        
        <div className={styles.settingsGrid}>
          <div className={styles.settingsSection}>
            <h2 className={styles.sectionTitle}>General Information</h2>
            
            <form onSubmit={handleGeneralSubmit} className={styles.settingsForm}>
              <div className={styles.formGroup}>
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={generalForm.name}
                  onChange={handleGeneralChange}
                  className={styles.formInput}
                  required
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={generalForm.email}
                  onChange={handleGeneralChange}
                  className={styles.formInput}
                  required
                />
              </div>
              
              <button
                type="submit"
                className={styles.saveButton}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
          
          <div className={styles.settingsSection}>
            <h2 className={styles.sectionTitle}>Professional Profile</h2>
            
            <form onSubmit={handleProfileSubmit} className={styles.settingsForm}>
              <div className={styles.formGroup}>
                <label htmlFor="title">Professional Title</label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={profileForm.title}
                  onChange={handleProfileChange}
                  className={styles.formInput}
                  placeholder="e.g., Clinical Psychologist"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="organization">Organization</label>
                <input
                  id="organization"
                  name="organization"
                  type="text"
                  value={profileForm.organization}
                  onChange={handleProfileChange}
                  className={styles.formInput}
                  placeholder="Your practice or institution"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="specialties">Specialties</label>
                <input
                  id="specialties"
                  name="specialties"
                  type="text"
                  value={profileForm.specialties}
                  onChange={handleProfileChange}
                  className={styles.formInput}
                  placeholder="Comma-separated list (e.g., Trauma, Anxiety, Depression)"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={profileForm.bio}
                  onChange={handleProfileChange}
                  className={styles.formTextarea}
                  rows={4}
                  placeholder="A brief professional bio..."
                />
              </div>
              
              <button
                type="submit"
                className={styles.saveButton}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </div>
          
          <div className={styles.settingsSection}>
            <h2 className={styles.sectionTitle}>Change Password</h2>
            
            <form onSubmit={handlePasswordSubmit} className={styles.settingsForm}>
              <div className={styles.formGroup}>
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  className={styles.formInput}
                  required
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  className={styles.formInput}
                  required
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  className={styles.formInput}
                  required
                />
              </div>
              
              <button
                type="submit"
                className={styles.saveButton}
                disabled={isSaving}
              >
                {isSaving ? 'Changing Password...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default withAuth(Settings);