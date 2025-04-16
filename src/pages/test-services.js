// src/pages/test-services.js
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import CollectionService from '../services/CollectionService';
import AudioFileService from '../services/AudioFileService';

export default function TestServices() {
  const [testResults, setTestResults] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Function to capture console output
  const captureConsoleLogs = () => {
    const logs = [];
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    // Override console methods
    console.log = (...args) => {
      logs.push(['log', ...args]);
      originalConsoleLog(...args);
    };
    
    console.error = (...args) => {
      logs.push(['error', ...args]);
      originalConsoleError(...args);
    };
    
    console.warn = (...args) => {
      logs.push(['warn', ...args]);
      originalConsoleWarn(...args);
    };
    
    // Return function to restore console and get logs
    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      
      return logs;
    };
  };
  
  // Format console logs to string
  const formatLogs = (logs) => {
    return logs.map(log => {
      const [type, ...messages] = log;
      const prefix = type === 'error' ? '❌ ' : type === 'warn' ? '⚠️ ' : '📝 ';
      
      const formattedMessages = messages.map(msg => {
        if (typeof msg === 'object') {
          return JSON.stringify(msg, null, 2);
        }
        return String(msg);
      }).join(' ');
      
      return `${prefix}${formattedMessages}`;
    }).join('\n');
  };
  
  // Test CollectionService
  const testCollectionService = async () => {
    setIsLoading(true);
    setTestResults('');
    setError(null);
    
    const getResults = captureConsoleLogs();
    
    try {
      const collectionService = new CollectionService({
        enableLogging: true
      });
      
      // Test getting all collections
      console.log('=== Testing CollectionService ===');
      console.log('\n1. Getting all collections...');
      
      const collections = await collectionService.getCollections();
      console.log(`Found ${collections.data?.length || 0} collections`);
      
      // Test getting a specific collection if available
      if (collections.data && collections.data.length > 0) {
        const firstCollection = collections.data[0];
        console.log(`\n2. Getting collection: ${firstCollection.id}`);
        
        const collection = await collectionService.getCollection(firstCollection.id);
        console.log(`Got collection: ${collection.data?.name}`);
        
        // Test formatting
        console.log('\n3. Formatting collection for player...');
        
        if (collection.success && collection.data) {
          const formatted = collectionService.formatCollectionForPlayer(collection.data);
          
          console.log('Formatted collection layers:');
          Object.entries(formatted.layers).forEach(([layerFolder, tracks]) => {
            console.log(`  ${layerFolder}: ${tracks.length} tracks`);
          });
        }
      }
      
      // Restore console and get logs
      const logs = getResults();
      setTestResults(formatLogs(logs));
    } catch (error) {
      console.error('CollectionService test error:', error);
      setError(error.message);
      
      // Restore console and get logs
      const logs = getResults();
      setTestResults(formatLogs(logs));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Test AudioFileService
  const testAudioFileService = async () => {
    setIsLoading(true);
    setTestResults('');
    setError(null);
    
    const getResults = captureConsoleLogs();
    
    try {
      const audioFileService = new AudioFileService({
        enableLogging: true
      });
      
      // Sample URLs to test
      const testUrls = [
        '/samples/default/drone.mp3',
        '/collections/Stillness/Layer_1/drone.mp3',
        'https://example.com/audio/test.mp3',
      ];
      
      console.log('=== Testing AudioFileService ===');
      
      // Test resolving a single URL
      console.log('\n1. Resolving single URL...');
      const resolvedUrl = await audioFileService.getAudioUrl(testUrls[0]);
      console.log(`Original: ${testUrls[0]}`);
      console.log(`Resolved: ${resolvedUrl}`);
      
      // Test batch resolving
      console.log('\n2. Batch resolving URLs...');
      const batchResults = await audioFileService.batchResolveUrls(testUrls);
      
      console.log('Batch results:');
      batchResults.forEach((resolved, original) => {
        console.log(`  Original: ${original}`);
        console.log(`  Resolved: ${resolved}`);
        console.log('---');
      });
      
      // Test with a mock collection
      console.log('\n3. Resolving collection URLs...');
      
      const mockCollection = {
        id: 'test-collection',
        name: 'Test Collection',
        tracks: [
          {
            id: 'track1',
            title: 'Track 1',
            audioUrl: testUrls[0],
            variations: [
              {
                id: 'track1-var1',
                title: 'Track 1 Variation',
                audioUrl: testUrls[1]
              }
            ]
          },
          {
            id: 'track2',
            title: 'Track 2',
            audioUrl: testUrls[2]
          }
        ]
      };
      
      const resolvedCollection = await audioFileService.resolveCollectionUrls(mockCollection);
      
      console.log('Resolved collection tracks:');
      resolvedCollection.tracks.forEach(track => {
        console.log(`  Track: ${track.title}`);
        console.log(`  URL: ${track.audioUrl}`);
        
        if (track.variations) {
          track.variations.forEach(variation => {
            console.log(`  Variation: ${variation.title}`);
            console.log(`  URL: ${variation.audioUrl}`);
          });
        }
        console.log('---');
      });
      
      // Restore console and get logs
      const logs = getResults();
      setTestResults(formatLogs(logs));
    } catch (error) {
      console.error('AudioFileService test error:', error);
      setError(error.message);
      
      // Restore console and get logs
      const logs = getResults();
      setTestResults(formatLogs(logs));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Test both services
  const testAllServices = async () => {
    setIsLoading(true);
    setTestResults('');
    setError(null);
    
    const getResults = captureConsoleLogs();
    
    try {
      // Test CollectionService
      await testCollectionService();
      
      // Test AudioFileService
      await testAudioFileService();
      
      // Restore console and get logs
      const logs = getResults();
      setTestResults(formatLogs(logs));
    } catch (error) {
      console.error('Service tests error:', error);
      setError(error.message);
      
      // Restore console and get logs
      const logs = getResults();
      setTestResults(formatLogs(logs));
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'Archivo, sans-serif',
      backgroundColor: '#181818',
      color: '#eaeaea',
      minHeight: '100vh'
    }}>
      <Head>
        <title>Test Services | Ensō Audio</title>
      </Head>
      
      <h1 style={{ 
        fontWeight: 200, 
        fontSize: '2rem', 
        textAlign: 'center',
        letterSpacing: '4px'
      }}>
        Ensō Audio Services Test
      </h1>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '15px',
        margin: '30px 0'
      }}>
        <button
          onClick={testCollectionService}
          disabled={isLoading}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #ffffff',
            color: '#ffffff',
            fontFamily: 'Archivo, sans-serif',
            fontWeight: 200,
            fontSize: '0.9rem',
            padding: '10px 20px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: isLoading ? 0.5 : 1
          }}
        >
          Test Collection Service
        </button>
        
        <button
          onClick={testAudioFileService}
          disabled={isLoading}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #ffffff',
            color: '#ffffff',
            fontFamily: 'Archivo, sans-serif',
            fontWeight: 200,
            fontSize: '0.9rem',
            padding: '10px 20px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: isLoading ? 0.5 : 1
          }}
        >
          Test Audio File Service
        </button>
        
        <button
          onClick={testAllServices}
          disabled={isLoading}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #ffffff',
            color: '#ffffff',
            fontFamily: 'Archivo, sans-serif',
            fontWeight: 200,
            fontSize: '0.9rem',
            padding: '10px 20px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: isLoading ? 0.5 : 1
          }}
        >
          Test All Services
        </button>
      </div>
      
      {error && (
        <div style={{
          padding: '15px',
          backgroundColor: 'rgba(255, 70, 70, 0.2)',
          border: '1px solid #ff4646',
          borderRadius: '2px',
          marginBottom: '20px',
          color: '#ff7070'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontWeight: 300 }}>Error</h3>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}
      
      {isLoading && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#aaaaaa'
        }}>
          Running tests...
        </div>
      )}
      
      {testResults && (
        <div style={{
          marginTop: '20px',
          backgroundColor: '#1c1c1c',
          border: '1px solid #333',
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '10px 15px',
            backgroundColor: '#252525',
            borderBottom: '1px solid #333',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0, fontWeight: 300, fontSize: '1rem' }}>Test Results</h3>
            <span style={{ fontSize: '0.8rem', color: '#aaaaaa' }}>
              {new Date().toLocaleTimeString()}
            </span>
          </div>
          
          <pre style={{
            margin: 0,
            padding: '15px',
            overflow: 'auto',
            maxHeight: '500px',
            fontFamily: 'Space Mono, monospace',
            fontSize: '0.85rem',
            lineHeight: '1.5',
            color: '#cccccc',
            whiteSpace: 'pre-wrap'
          }}>
            {testResults}
          </pre>
        </div>
      )}
    </div>
  );
}