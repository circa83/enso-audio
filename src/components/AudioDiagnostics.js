// src/components/debug/AudioDiagnostics.js
import { useEffect } from 'react';
import { useAudio } from '../../contexts/AudioContext';

/**
 * AudioDiagnostics - Silent component that runs diagnostic checks on the audio system
 * and attempts to fix common issues during initialization
 */
const AudioDiagnostics = () => {
  const { 
    audioCore,
    activateAudio,
    isAudioActivated
  } = useAudio();

  useEffect(() => {
    // Function to diagnose and fix common audio issues
    const runAudioDiagnostics = async () => {
      console.log('Running audio system diagnostics...');

      // Check if we have an audio context
      if (!audioCore || !audioCore.audioContext) {
        console.warn('Audio core or context not initialized');
        return;
      }

      // Log audio context state
      console.log(`Audio context state: ${audioCore.audioContext.state}`);

      // Check for browser autoplay policy issues
      if (audioCore.audioContext.state === 'suspended' && !isAudioActivated) {
        console.log('Attempting to activate suspended audio context...');
        try {
          await activateAudio();
        } catch (error) {
          console.warn('Error activating audio:', error);
        }
      }

      // Ensure audio debugger is attached
      if (!window._audioDebuggerAttached) {
        // Add a global error handler to catch audio-related errors
        const originalOnError = window.onerror;
        window.onerror = function(message, source, lineno, colno, error) {
          // Check if error is audio-related
          if (message && (
              message.includes('audio') || 
              message.includes('AudioContext') || 
              message.includes('play()')
          )) {
            console.error('Audio-related error detected:', message);
            
            // Try to recover audio context if possible
            if (audioCore && audioCore.audioContext && audioCore.audioContext.state === 'suspended') {
              console.log('Attempting to resume suspended audio context after error...');
              audioCore.audioContext.resume().catch(e => {
                console.warn('Failed to resume audio context after error:', e);
              });
            }
          }
          
          // Call original handler if it exists
          if (originalOnError) {
            return originalOnError(message, source, lineno, colno, error);
          }
          
          // Don't prevent default error handling
          return false;
        };

        // Add debug methods to window for console access
        window._audioDebug = {
          resumeContext: async () => {
            if (audioCore && audioCore.audioContext) {
              try {
                await audioCore.audioContext.resume();
                console.log(`Audio context state after manual resume: ${audioCore.audioContext.state}`);
                return audioCore.audioContext.state;
              } catch (error) {
                console.error('Error resuming audio context:', error);
                return 'error';
              }
            }
            return 'no context';
          },
          playTestTone: () => {
            if (audioCore && audioCore.audioContext) {
              try {
                const oscillator = audioCore.audioContext.createOscillator();
                const gainNode = audioCore.audioContext.createGain();
                
                // Set very low volume
                gainNode.gain.value = 0.01;
                
                // Connect nodes
                oscillator.connect(gainNode);
                gainNode.connect(audioCore.audioContext.destination);
                
                // Set frequency and start tone
                oscillator.frequency.value = 440;
                oscillator.start();
                
                // Stop after 0.5 seconds
                setTimeout(() => {
                  oscillator.stop();
                  console.log('Test tone completed');
                }, 500);
                
                console.log('Playing test tone...');
                return true;
              } catch (error) {
                console.error('Error playing test tone:', error);
                return false;
              }
            }
            return false;
          },
          getAudioState: () => {
            if (!audioCore) return { status: 'No audio core' };
            
            return {
              contextState: audioCore.audioContext?.state || 'no context',
              isPlaying: audioCore.isPlaying,
              masterVolume: audioCore.getMasterVolume(),
              gainNodes: Object.entries(audioCore.gainNodes).reduce((acc, [layer, node]) => {
                acc[layer] = node ? 'connected' : 'missing';
                return acc;
              }, {}),
              audioElements: Object.entries(audioCore.audioElements).reduce((acc, [layer, elements]) => {
                acc[layer] = Object.keys(elements);
                return acc;
              }, {})
            };
          }
        };
        
        window._audioDebuggerAttached = true;
        console.log('Audio debugger attached to window. Use window._audioDebug in console for diagnostics.');
      }
    };

    // Run diagnostics
    runAudioDiagnostics();
    
    // Set up a recurring check every 5 seconds for the first minute
    // This helps catch issues that might occur after initial load
    let checkCount = 0;
    const diagnosticInterval = setInterval(() => {
      checkCount++;
      if (checkCount < 12) { // Run for 1 minute (12 * 5 seconds)
        runAudioDiagnostics();
      } else {
        clearInterval(diagnosticInterval);
      }
    }, 5000);

    return () => {
      clearInterval(diagnosticInterval);
    };
  }, [audioCore, activateAudio, isAudioActivated]);

  // This is a diagnostic component only - it doesn't render anything
  return null;
};

export default AudioDiagnostics;