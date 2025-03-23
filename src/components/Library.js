import React, { useState } from 'react';
import { useAudio } from '../contexts/StreamingAudioContext';
import styles from '../styles/pages/Library.module.css';

// Categories for sample organization
const CATEGORIES = ['Drones', 'Melody', 'Rhythm', 'Nature'];

// Sample audio files for demo purpose
const DEMO_SAMPLES = [
  { id: 1, name: 'Deep Drone', category: 'Drones', path: '/samples/drones.mp3' },
  { id: 2, name: 'Harmonic Drone', category: 'Drones', path: '/samples/drones_harmonic.mp3' },
  { id: 3, name: 'Gentle Melody', category: 'Melody', path: '/samples/melody.mp3' },
  { id: 4, name: 'Evolving Melody', category: 'Melody', path: '/samples/melody_evolving.mp3' },
  { id: 5, name: 'Soft Rhythm', category: 'Rhythm', path: '/samples/rhythm.mp3' },
  { id: 6, name: 'Heartbeat Rhythm', category: 'Rhythm', path: '/samples/rhythm_heartbeat.mp3' },
  { id: 7, name: 'Forest Sounds', category: 'Nature', path: '/samples/nature.mp3' },
  { id: 8, name: 'Ocean Waves', category: 'Nature', path: '/samples/nature_ocean.mp3' },
];

const Library = ({ onNavigate }) => {
  const { updateAvailableLayers } = useAudio();
  const [samples, setSamples] = useState(DEMO_SAMPLES);
  const [selectedSamples, setSelectedSamples] = useState({
    drones: '/samples/drones.mp3',
    melody: '/samples/melody.mp3',
    rhythm: '/samples/rhythm.mp3',
    nature: '/samples/nature.mp3',
  });
  const [uploadingCategory, setUploadingCategory] = useState(null);
  
  // Handle file upload
  const handleFileUpload = (event, category) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Create a temporary URL for the file
    const url = URL.createObjectURL(file);
    
    // Add to samples list
    const newSample = {
      id: Date.now(),
      name: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
      category,
      path: url,
      isCustom: true
    };
    
    setSamples(prevSamples => [...prevSamples, newSample]);
    
    // Hide the upload UI
    setUploadingCategory(null);
    
    // Show confirmation
    alert(`Sample ${file.name} uploaded successfully!`);
  };
  
  // Handle sample selection
  const handleSelectSample = (category, path) => {
    const categoryKey = category.toLowerCase();
    
    setSelectedSamples(prev => ({
      ...prev,
      [categoryKey]: path
    }));
    
    // Update the audio context
    updateAvailableLayers({
      ...selectedSamples,
      [categoryKey]: path
    });
  };
  
  // Render upload UI
  const renderUploadUI = (category) => {
    return (
      <div className={styles['upload-container']}>
        <input 
          type="file" 
          accept="audio/*" 
          onChange={(e) => handleFileUpload(e, category)}
          className={styles['file-input']}
        />
        <button 
          className={styles['cancel-upload-btn']}
          onClick={() => setUploadingCategory(null)}
        >
          Cancel
        </button>
      </div>
    );
  };
  
  return (
    <div className={styles['library-container']}>
      <h1>Audio Library</h1>
      <p className={styles['library-description']}>
        Select audio samples for each category or upload your own custom files.
      </p>
      
      {CATEGORIES.map(category => (
        <div key={category} className={styles['category-section']}>
          <div className={styles['category-header']}>
            <h2 className={styles['category-title']}>{category}</h2>
            <button 
              className={styles['upload-btn']}
              onClick={() => setUploadingCategory(category)}
            >
              Upload Custom
            </button>
          </div>
          
          {uploadingCategory === category ? (
            renderUploadUI(category)
          ) : (
            <div className={styles['samples-list']}>
              {samples
                .filter(sample => sample.category === category)
                .map(sample => (
                  <div 
                    key={sample.id} 
                    className={`${styles['sample-item']} ${
                      selectedSamples[category.toLowerCase()] === sample.path ? styles.selected : ''
                    }`}
                    onClick={() => handleSelectSample(category, sample.path)}
                  >
                    <span className={styles['sample-name']}>{sample.name}</span>
                    {sample.isCustom && <span className={styles['custom-badge']}>Custom</span>}
                  </div>
                ))
              }
            </div>
          )}
        </div>
      ))}
      
      <div className={styles['library-actions']}>
        <button 
          className={styles['return-btn']}
          onClick={() => onNavigate('player')}
        >
          Return to Player
        </button>
      </div>
    </div>
  );
};

export default Library;