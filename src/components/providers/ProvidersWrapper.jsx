// src/components/providers/ProvidersWrapper.jsx
import { AudioProvider, useAudioContext } from '../../contexts/AudioContext';
import { AuthProvider } from '../../contexts/AuthContext';
import { VolumeProvider } from '../../contexts/VolumeContext';
import { CollectionProvider } from '../../contexts/CollectionContext';

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

// Main providers wrapper
export function ProvidersWrapper({ children }) {
  return (
    <AuthProvider>
      <AudioProvider>
        {/* Use the intermediate component instead of directly using VolumeProvider */}
        <VolumeProviderWithAudio>
          <CollectionProvider>
            {children}
          </CollectionProvider>
        </VolumeProviderWithAudio>
      </AudioProvider>
    </AuthProvider>
  );
}
