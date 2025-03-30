// File: src/tests/crossfade-test.js
// This is a simple test file to verify the CrossfadeEngine integration
// Run this in browser console after defining the test function

function testCrossfadeEngineIntegration() {
  console.log("Testing CrossfadeEngine integration...");
  
  // Get the audio context from window (if it's available)
  const audioContext = window.audioContextInstance;
  
  if (!audioContext) {
    console.error("Audio context not available. Make sure the app is initialized.");
    return false;
  }
  
  // Step 1: Create test audio elements
  console.log("Step 1: Creating test audio elements");
  const audioElement1 = new Audio('/samples/default/drone.mp3');
  const audioElement2 = new Audio('/samples/default/melody.mp3');
  
  audioElement1.loop = true;
  audioElement2.loop = true;
  
  // Step 2: Create Web Audio API nodes
  console.log("Step 2: Creating audio nodes");
  let ctx, masterGain, source1, source2, crossfadeEngine;
  
  try {
    // Create test context if needed
    ctx = audioContext.getContext ? 
      audioContext.getContext() : 
      new (window.AudioContext || window.webkitAudioContext)();
    
    // Create master gain
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
    
    // Create source nodes
    source1 = ctx.createMediaElementSource(audioElement1);
    source2 = ctx.createMediaElementSource(audioElement2);
    
    // Connect sources to master initially
    source1.connect(masterGain);
    source2.connect(masterGain);
    
    console.log("Audio nodes created successfully");
  } catch (error) {
    console.error("Error creating audio nodes:", error);
    return false;
  }
  
  // Step 3: Create CrossfadeEngine
  console.log("Step 3: Creating CrossfadeEngine");
  try {
    // Create a new CrossfadeEngine instance
    // Note: We should import this, but for testing we'll try to get it from window
    const CrossfadeEngine = window.CrossfadeEngine || 
      (typeof require !== 'undefined' ? require('../services/audio/CrossfadeEngine').default : null);
    
    if (!CrossfadeEngine) {
      console.error("CrossfadeEngine not found. Make sure it's properly imported.");
      return false;
    }
    
    crossfadeEngine = new CrossfadeEngine({
      audioContext: ctx,
      destination: masterGain,
      enableLogging: true,
      onProgress: (layer, progress) => {
        console.log(`Crossfade progress for ${layer}: ${(progress * 100).toFixed(1)}%`);
      }
    });
    
    console.log("CrossfadeEngine created successfully");
  } catch (error) {
    console.error("Error creating CrossfadeEngine:", error);
    return false;
  }
  
  // Step 4: Start audio playback
  console.log("Step 4: Starting audio playback");
  try {
    // Start the first audio element
    const playPromise = audioElement1.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.error("Error playing audio:", err);
      });
    }
  } catch (error) {
    console.error("Error starting playback:", error);
    // Continue anyway for testing
  }
  
  // Step 5: Perform a crossfade
  console.log("Step 5: Performing crossfade (after 2 second delay)");
  setTimeout(() => {
    try {
      // Perform the crossfade
      crossfadeEngine.crossfade({
        layer: 'test',
        sourceNode: source1,
        sourceElement: audioElement1,
        targetNode: source2,
        targetElement: audioElement2,
        currentVolume: 0.5,
        duration: 3000,
        syncPosition: false
      }).then(success => {
        if (success) {
          console.log("✅ Crossfade completed successfully");
        } else {
          console.error("❌ Crossfade failed");
        }
      });
    } catch (error) {
      console.error("Error during crossfade:", error);
    }
  }, 2000);
  
  // Step 6: Clean up after test (after 8 seconds)
  setTimeout(() => {
    console.log("Step 6: Cleaning up");
    
    try {
      // Stop audio
      audioElement1.pause();
      audioElement2.pause();
      
      // Dispose crossfade engine
      crossfadeEngine.dispose();
      
      console.log("Test cleanup completed");
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
    
    console.log("CrossfadeEngine integration test completed");
  }, 8000);
  
  return true;
}

// Export for use in browser or Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testCrossfadeEngineIntegration };
} else if (typeof window !== 'undefined') {
  // Make available globally for browser testing
  window.testCrossfadeEngineIntegration = testCrossfadeEngineIntegration;
}

// Instructions for manual testing:
// 1. Open browser console
// 2. Run: testCrossfadeEngineIntegration()
// 3. Observe logs and listen for audio transition