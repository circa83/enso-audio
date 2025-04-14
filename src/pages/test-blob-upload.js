// src/pages/test-blob-upload.js
import React, { useState, useRef, useCallback } from 'react';
import Head from 'next/head';

export default function TestBlobUpload() {
  const [uploadType, setUploadType] = useState('single');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [collectionId, setCollectionId] = useState('');
  const [folder, setFolder] = useState('');
  const [uploadDetails, setUploadDetails] = useState(null);
  
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const layerInputRefs = {
    Layer_1: useRef(null),
    Layer_2: useRef(null),
    Layer_3: useRef(null),
    Layer_4: useRef(null)
  };
  
  // Handle file selection logging
  const logFileSelection = useCallback((files, type) => {
    if (!files || files.length === 0) return;
    
    const fileDetails = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      fileDetails.push({
        name: file.name,
        type: file.type,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
      });
    }
    
    console.log(`[test-blob-upload] Selected ${files.length} ${type} files:`, fileDetails);
    return fileDetails;
  }, []);
  
  const handleUpload = async (e) => {
    e.preventDefault();
    
    try {
      setUploading(true);
      setError(null);
      setResult(null);
      setUploadDetails(null);
      
      // Create FormData for the upload
      const formData = new FormData();
      formData.append('uploadType', uploadType);
      console.log(`[test-blob-upload] Starting ${uploadType} upload`);
      
      let fileDetails = null;
      
      switch (uploadType) {
        case 'single': {
          const file = fileInputRef.current.files[0];
          if (!file) {
            throw new Error('Please select a file to upload');
          }
          
          fileDetails = logFileSelection([file], 'single');
          formData.append('file', file);
          
          if (folder) {
            formData.append('folder', folder);
            console.log(`[test-blob-upload] Using folder: ${folder}`);
          }
          break;
        }
        
        case 'multiple': {
          const files = fileInputRef.current.files;
          if (!files || files.length === 0) {
            throw new Error('Please select files to upload');
          }
          
          fileDetails = logFileSelection(files, 'multiple');
          
          for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
          }
          
          if (folder) {
            formData.append('folder', folder);
            console.log(`[test-blob-upload] Using folder: ${folder}`);
          }
          break;
        }
        
        case 'collection': {
          if (!collectionId) {
            throw new Error('Collection ID is required');
          }
          
          formData.append('collectionId', collectionId);
          console.log(`[test-blob-upload] Collection ID: ${collectionId}`);
          
          // Cover files
          const coverFiles = coverInputRef.current.files;
          fileDetails = {
            cover: logFileSelection(coverFiles, 'cover')
          };
          
          for (let i = 0; i < coverFiles.length; i++) {
            formData.append('cover', coverFiles[i]);
          }
          
          // Layer files
          fileDetails.layers = {};
          
          Object.entries(layerInputRefs).forEach(([layerName, ref]) => {
            const layerFiles = ref.current.files;
            if (layerFiles.length > 0) {
              fileDetails.layers[layerName] = logFileSelection(layerFiles, layerName);
              
              for (let i = 0; i < layerFiles.length; i++) {
                formData.append(`layer_${layerName}`, layerFiles[i]);
              }
            }
          });
          break;
        }
      }
      
      // Store upload details for display
      setUploadDetails(fileDetails);
      
      // Configure fetch options
      const fetchOptions = {
        method: 'POST',
        body: formData,
        // Important: No Content-Type header, let the browser set it with boundary
      };
      
      // Send upload request
      console.log(`[test-blob-upload] Sending request to /api/upload`);
      const response = await fetch('/api/upload', fetchOptions);
      
      // Get response as text first to debug any JSON parsing errors
      const responseText = await response.text();

      console.log('[test-blob-upload] Raw response:', responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));

// Check if response is HTML (indicating an error page)
if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
  console.error('[test-blob-upload] Received HTML response instead of JSON');
  throw new Error('Server returned an HTML error page. Check server logs for details.');
}
      let data;
      
      try {
        // Try to parse the response text as JSON
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[test-blob-upload] Error parsing response:`, parseError);
        console.log('Response text:', responseText);
        throw new Error(`Failed to parse server response: ${parseError.message}`);
      }
      
      if (!response.ok) {
        const errorMessage = data.error || data.message || `Server error: ${response.status}`;
        console.error(`[test-blob-upload] Upload failed:`, data);
        throw new Error(errorMessage);
      }
      
      console.log(`[test-blob-upload] Upload successful:`, data);
      setResult(data);
    } catch (err) {
      console.error(`[test-blob-upload] Upload error:`, err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'Archivo, sans-serif', color: '#eaeaea', backgroundColor: '#181818' }}>
      <Head>
        <title>Test Blob Upload | Ensō Audio</title>
      </Head>
      
      <h1 style={{ fontWeight: 200, letterSpacing: '2px' }}>Test Vercel Blob Upload</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '10px' }}>Upload Type:</label>
        <div style={{ display: 'flex', gap: '15px' }}>
          {['single', 'multiple', 'collection'].map(type => (
            <button 
              key={type}
              onClick={() => setUploadType(type)}
              style={{
                padding: '8px 16px',
                background: uploadType === type ? '#252525' : 'transparent',
                border: uploadType === type ? '1px solid #fff' : '1px solid #444',
                color: uploadType === type ? '#fff' : '#aaa',
                cursor: 'pointer'
              }}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      <form onSubmit={handleUpload} style={{ marginTop: '20px' }}>
        {/* Single & Multiple Upload UI */}
        {(uploadType === 'single' || uploadType === 'multiple') && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px' }}>
                Select {uploadType === 'single' ? 'File' : 'Files'}:
              </label>
              <input
                type="file"
                ref={fileInputRef}
                multiple={uploadType === 'multiple'}
                style={{ display: 'block', marginBottom: '10px' }}
                onChange={(e) => logFileSelection(e.target.files, uploadType)}
              />
              <small style={{ color: '#aaa' }}>
                Allowed audio formats: MP3, WAV, OGG, AAC, FLAC, WebM<br />
                Allowed image formats: JPEG, PNG, WebP, SVG<br />
                Maximum file size: 100 MB
              </small>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px' }}>
                Folder Path (optional):
              </label>
              <input
                type="text"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="e.g., collections/Stillness/Layer_1"
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#252525',
                  border: '1px solid #333',
                  color: '#fff'
                }}
              />
              <small style={{ color: '#aaa' }}>
                Specify a folder path for the file(s)
              </small>
            </div>
          </>
        )}
        
        {/* Collection Upload UI */}
        {uploadType === 'collection' && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px' }}>
                Collection ID:
              </label>
              <input
                type="text"
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                placeholder="e.g., my-awesome-collection"
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#252525',
                  border: '1px solid #333',
                  color: '#fff'
                }}
                required
              />
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px' }}>
                Cover Images:
              </label>
              <input
                type="file"
                ref={coverInputRef}
                multiple
                accept="image/*"
                style={{ display: 'block', marginBottom: '10px' }}
                onChange={(e) => logFileSelection(e.target.files, 'cover')}
              />
              <small style={{ color: '#aaa' }}>
                Upload cover images for the collection
              </small>
            </div>
            
            {/* Layer file inputs */}
            {Object.entries(layerInputRefs).map(([layerName, ref]) => (
              <div key={layerName} style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '10px' }}>
                  {layerName.replace('_', ' ')} Files:
                </label>
                <input
                  type="file"
                  ref={ref}
                  multiple
                  accept="audio/*"
                  style={{ display: 'block', marginBottom: '10px' }}
                  onChange={(e) => logFileSelection(e.target.files, layerName)}
                />
                <small style={{ color: '#aaa' }}>
                  Upload audio files for {layerName.replace('_', ' ')}
                </small>
              </div>
            ))}
          </>
        )}
        
        <button
          type="submit"
          disabled={uploading}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            border: '1px solid #fff',
            color: '#fff',
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.7 : 1,
            marginTop: '20px'
          }}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
      
      {/* Upload details display */}
      {uploadDetails && !error && !result && (
        <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(70, 130, 180, 0.1)', border: '1px solid #4682b4', color: '#add8e6' }}>
          <h3>Upload in Progress</h3>
          <p>Uploading the following files to Vercel Blob:</p>
          <pre style={{ overflow: 'auto', maxHeight: '200px', background: '#111', padding: '10px', color: '#ddd' }}>
            {JSON.stringify(uploadDetails, null, 2)}
          </pre>
        </div>
      )}
      
      {error && (
        <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(255, 107, 107, 0.1)', border: '1px solid #ff6b6b', color: '#ff6b6b' }}>
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      )}
      
      {result && (
        <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(107, 255, 148, 0.1)', border: '1px solid #6bff94', color: '#6bff94' }}>
          <h3>Upload Successful</h3>
          <pre style={{ overflow: 'auto', maxHeight: '300px', background: '#111', padding: '10px', color: '#ddd' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
      
      {/* Debug information */}
      <div style={{ marginTop: '30px', borderTop: '1px solid #333', paddingTop: '20px' }}>
        <h3 style={{ color: '#aaa', fontSize: '0.9rem' }}>Debug Information</h3>
        <ul style={{ color: '#888', fontSize: '0.8rem' }}>
          <li>Upload Type: {uploadType}</li>
          {folder && <li>Folder Path: {folder}</li>}
          {collectionId && <li>Collection ID: {collectionId}</li>}
          <li>API Endpoint: /api/upload</li>
          <li>Store ID: {process.env.BLOB_STORE_ID || 'Not set in environment (using default)'}</li>
        </ul>
        <p style={{ color: '#777', fontSize: '0.8rem', fontStyle: 'italic', marginTop: '10px' }}>
          Check the browser console for detailed logs
        </p>
      </div>
    </div>
  );
}