// pages/_error.js
import React from 'react';
import Link from 'next/link';
import Head from 'next/head';

function ErrorPage({ statusCode, errorMessage }) {
  // Determine if this is a server or client error
  const isServerError = statusCode >= 500;
  const isAuthError = statusCode === 401 || statusCode === 403;
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      textAlign: 'center',
      backgroundColor: '#121212',
      color: '#eaeaea',
      fontFamily: 'Archivo, sans-serif'
    }}>
      <Head>
        <title>{`Error ${statusCode || ''} | Ensō Audio`}</title>
      </Head>
      
      <h1 style={{ 
        fontWeight: 100, 
        fontSize: '2.5rem',
        marginBottom: '20px',
        letterSpacing: '4px'
      }}>
        {isServerError ? 'Server Error' : 
         isAuthError ? 'Authentication Error' : 
         'Something Went Wrong'}
      </h1>
      
      <p style={{ 
        maxWidth: '600px', 
        marginBottom: '30px',
        fontWeight: 200,
        lineHeight: '1.6'
      }}>
        {statusCode
          ? `${errorMessage || `An error ${statusCode} occurred on the server`}`
          : 'An error occurred on the client'}
      </p>
      
      {isAuthError ? (
        <div style={{ marginBottom: '30px' }}>
          <p>You may need to log in again to continue.</p>
        </div>
      ) : isServerError ? (
        <div style={{ marginBottom: '30px' }}>
          <p>Our team has been notified of this issue.</p>
          <p>Please try again later or contact support if the problem persists.</p>
        </div>
      ) : (
        <div style={{ marginBottom: '30px' }}>
          <p>Please try refreshing the page or returning to the home page.</p>
        </div>
      )}
      
      <div style={{ display: 'flex', gap: '15px' }}>
        <Link href="/" passHref>
          <button style={{
            backgroundColor: 'transparent',
            border: '1px solid #ffffff',
            color: '#ffffff',
            fontFamily: 'Archivo, sans-serif',
            fontWeight: '200',
            fontSize: '0.8rem',
            padding: '10px 20px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}>
            Return Home
          </button>
        </Link>
        
        {isAuthError && (
          <Link href="/login" passHref>
            <button style={{
              backgroundColor: 'transparent',
              border: '1px solid #888888',
              color: '#aaaaaa',
              fontFamily: 'Archivo, sans-serif',
              fontWeight: '200',
              fontSize: '0.8rem',
              padding: '10px 20px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>
              Log In
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}

// This gets called on both server-side and client-side
ErrorPage.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  const errorMessage = err ? err.message : '';
  
  // Log server-side errors
  if (res && statusCode >= 500) {
    console.error(`Server error ${statusCode}:`, err);
  }
  
  return { statusCode, errorMessage };
};

export default ErrorPage;