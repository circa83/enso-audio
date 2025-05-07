// src/pages/test-collections.js
import { useState, useEffect } from 'react';
import { useCollections } from '../hooks/useCollections';

export default function TestCollectionsPage() {
  const { collections, isLoading, error, loadCollections } = useCollections({ loadOnMount: true });
  const [blobFolders, setBlobFolders] = useState([]);
  const [blobError, setBlobError] = useState(null);
  const [diagnosticResult, setDiagnosticResult] = useState(null);
  
  // Fetch blob folders directly
  useEffect(() => {
    async function fetchBlobFolders() {
      try {
        const response = await fetch('/api/blob/list?prefix=collections/');
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const blobs = await response.json();
        
        // Extract folders
        const folders = new Set();
        blobs.forEach(blob => {
          const parts = blob.pathname.split('/');
          if (parts.length > 1 && parts[0] === 'collections') {
            folders.add(parts[1]);
          }
        });
        
        setBlobFolders(Array.from(folders));
      } catch (error) {
        console.error('Error fetching blob folders:', error);
        setBlobError(error.message);
      }
    }
    
    fetchBlobFolders();
  }, []);
  
  // Run diagnostic
  const runDiagnostic = async () => {
    try {
      const response = await fetch('/api/diagnostic/collections');
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const result = await response.json();
      setDiagnosticResult(result);
    } catch (error) {
      console.error('Diagnostic error:', error);
      setDiagnosticResult({ error: error.message });
    }
  };
  
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Collection Test Page</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Diagnostic Tools</h2>
        <button onClick={runDiagnostic}>Run Diagnostic</button>
        <button onClick={() => loadCollections()}>Reload Collections</button>
      </div>
      
      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1, border: '1px solid #ddd', padding: '15px' }}>
          <h2>Blob Storage Folders</h2>
          {blobError ? (
            <div style={{ color: 'red' }}>{blobError}</div>
          ) : (
            <>
              <div>Found {blobFolders.length} collection folders</div>
              <ul>
                {blobFolders.map(folder => (
                  <li key={folder}>{folder}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        
        <div style={{ flex: 1, border: '1px solid #ddd', padding: '15px' }}>
          <h2>MongoDB Collections</h2>
          {error ? (
            <div style={{ color: 'red' }}>{error}</div>
          ) : isLoading ? (
            <div>Loading collections...</div>
          ) : (
            <>
              <div>Found {collections.length} collections</div>
              <ul>
                {collections.map(collection => (
                  <li key={collection.id}>{collection.name} ({collection.id})</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      
      {diagnosticResult && (
        <div style={{ marginTop: '20px', border: '1px solid #ddd', padding: '15px' }}>
          <h2>Diagnostic Results</h2>
          <pre>{JSON.stringify(diagnosticResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}