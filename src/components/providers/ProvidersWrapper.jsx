// src/components/providers/ProvidersWrapper.jsx
import { AudioProvider, useAudioContext } from '../../contexts/AudioContext';
import { AuthProvider } from '../../contexts/AuthContext';
import { VolumeProvider, useVolumeContext } from '../../contexts/VolumeContext';
import { CollectionProvider } from '../../contexts/CollectionContext';
import { LayerProvider } from '../../contexts/LayerContext';
import { CrossfadeProvider, useCrossfadeContext } from '../../contexts/CrossfadeContext';
import { TimelineProvider } from '../../contexts/TimelineContext';
import { useBufferService } from '../../contexts/BufferContext';

// This intermediate component connects AudioProvider to VolumeProvider
function VolumeProviderWithAudio({ children }) {
  // Get audio context values from the AudioProvider
  const { audioContext, masterGain, initialized } = useAudioContext();
  
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

// Adapter for CrossfadeProvider that explicitly passes all needed dependencies
function CrossfadeProviderAdapter({ children }) {
  // Get audio context values from the AudioProvider
  const { audioContext, masterGain, initialized } = useAudioContext();
  
  // Get buffer service
  const bufferService = useBufferService();
  
  // Only render the CrossfadeProvider when all dependencies are available
  if (!initialized || !audioContext || !masterGain) {
    console.log('Waiting for audio dependencies before initializing CrossfadeProvider');
    return null;
  }
  
  return (
    <CrossfadeProvider 
      // Pass explicitly instead of relying on hooks inside CrossfadeProvider
      audioContext={audioContext}
      masterGain={masterGain}
      audioInitialized={initialized}
      bufferService={bufferService}
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
    const { audioContext, masterGain, initialized } = useAudioContext();
    
    // Get volume service - two options depending on which solution we use
    const volumeContext = useVolumeContext();
    const volumeService = volumeContext ? volumeContext.service : null;
    // Alternatively if we've added the useVolumeService hook: 
    // const volumeService = useVolumeService();
    
    // Get crossfade service
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
        {/* Use the intermediate component for VolumeProvider */}
        <VolumeProviderWithAudio>
          {/* Add CrossfadeProvider with adapter */}
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
        </VolumeProviderWithAudio>
      </AudioProvider>
    </AuthProvider>
  );
}
