// src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';

// Create the auth context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Check if we're still loading the session
  useEffect(() => {
    if (status !== 'loading') {
      setIsLoading(false);
    }
  }, [status]);
  
  // Login function
  const login = async (email, password) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });
      
      if (result?.error) {
        setError(result.error);
        return false;
      }
      
      return true;
    } catch (error) {
      setError('An unexpected error occurred');
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Register function - in a real app, this would call your API to create a user
  const register = async (name, email, password) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate an API call to create a user
      // In a real app, you would call your API to create a user in your database
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.message || 'Registration failed');
        return false;
      }
      
      // Automatically log in after successful registration
      return await login(email, password);
    } catch (error) {
      setError('An unexpected error occurred');
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Logout function
  const logout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };
  
  // Check if user is authenticated
  const isAuthenticated = !!session;
  
  // Get user data
  const user = session?.user;
  
  const value = {
    user,
    isLoading,
    isAuthenticated,
    error,
    login,
    register,
    logout,
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;