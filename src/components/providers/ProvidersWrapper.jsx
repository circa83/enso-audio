// src/components/providers/ProvidersWrapper.jsx
import React from 'react';
import { AudioProvider, useAudioContext } from '../../contexts/AudioContext';
import { AuthProvider } from '../../contexts/AuthContext';
import { VolumeProvider, useVolumeContext } from '../../contexts/VolumeContext';
import { CollectionProvider } from '../../contexts/CollectionContext';
import { LayerProvider } from '../../contexts/LayerContext';
import { CrossfadeProvider, useCrossfadeContext } from '../../contexts/CrossfadeContext';
import { TimelineProvider } from '../../contexts/TimelineContext';
import { BufferProvider } from '../../contexts/BufferContext'; // Add this import

// This intermediate component connects AudioProvider to VolumeProvider
function VolumeProviderWithAudio({ children }) {
  // Get audio context values from the AudioProvider
  const { audioContext, masterGain, initialized } = useAudioContext();
  
  // Only render when audio is initialized
  if (!initialized || !audioContext || !masterGain) {
    console.log('Waiting for audio context to initialize...');
    return null;
  }
  
  // Pass them to VolumeProvider
  return (
    <VolumeProvider
      audioContext={audioContext}
      masterGain={masterGain}
      initialized={initialized}
    >
      {children}
    </VolumeProvider>
  );
}

// This connects audio with BufferProvider
function BufferProviderWithAudio({ children }) {
  const { audioContext, initialized } = useAudioContext();
  
  // Only render when audio is initialized
  if (!initialized || !audioContext) {
    console.log('Waiting for audio context before initializing BufferProvider');
    return null;
  }
  
  return (
    <BufferProvider
      audioContext={audioContext}
      enableLogging={false}
    >
      {children}
    </BufferProvider>
  );
}

// Adapter for CrossfadeProvider 
function CrossfadeProviderAdapter({ children }) {
  // Get audio context values from the AudioProvider
  const { audioContext, masterGain, initialized } = useAudioContext();
  
  // Get volume context - now we need to check if it exists
  const volumeContext = useVolumeContext();
  const volumeService = volumeContext ? volumeContext.service : null;
  
  // Only render when all dependencies are available
  if (!initialized || !audioContext || !masterGain || !volumeService) {
    console.log('Waiting for audio dependencies before initializing CrossfadeProvider');
    return null;
  }
  
  return (
    <CrossfadeProvider 
      audioContext={audioContext}
      masterGain={masterGain}
      audioInitialized={initialized}
      volumeService={volumeService}
      defaultFadeDuration={2000}
      enableLogging={false}
    >
      {children}
    </CrossfadeProvider>
  );
}

// Adapter for TimelineProvider
function TimelineProviderAdapter({ children }) {
  // Get audio context values
  const { audioContext, initialized } = useAudioContext();
  
  // Get volume context
  const volumeContext = useVolumeContext();
  const volumeService = volumeContext ? volumeContext.service : null;
  
  // Get crossfade context
  const crossfadeContext = useCrossfadeContext();
  const crossfadeEngine = crossfadeContext ? crossfadeContext.service : null;
  
  // Only render when dependencies are available
  if (!initialized || !audioContext || !volumeService || !crossfadeEngine) {
    console.log('Waiting for dependencies before initializing TimelineProvider');
    return null;
  }
  
  return (
    <TimelineProvider
      volumeController={volumeService}
      crossfadeEngine={crossfadeEngine}
      initialSessionDuration={3600000}
      initialTransitionDuration={4000}
      initialPhases={[]}
    >
      {children}
    </TimelineProvider>
  );
}

// Main providers wrapper
export function ProvidersWrapper({ children }) {
  return (
    <AuthProvider>
      <AudioProvider>
        {/* First, connect audio to volume */}
        <VolumeProviderWithAudio>
          {/* Add the missing BufferProvider */}
          <BufferProviderWithAudio>
            {/* Now add CrossfadeProvider with adapter */}
            <CrossfadeProviderAdapter>
              {/* Add TimelineProvider with adapter */}
              <TimelineProviderAdapter>
                <LayerProvider>
                  <CollectionProvider>
                    {children}
                  </CollectionProvider>
                </LayerProvider>
              </TimelineProviderAdapter>
            </CrossfadeProviderAdapter>
          </BufferProviderWithAudio>
        </VolumeProviderWithAudio>
      </AudioProvider>
    </AuthProvider>
  );
}
