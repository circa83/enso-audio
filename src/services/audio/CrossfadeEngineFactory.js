/**
 * CrossfadeEngineFactory.js
 * 
 * Factory for creating and managing CrossfadeEngine instances.
 * Provides access to the crossfade engine service.
 */

import CrossfadeEngine from './CrossfadeEngine';

// Singleton instance
let instance = null;

/**
 * Get the CrossfadeEngine instance, creating it if it doesn't exist
 * @param {AudioContext} audioContext - Web Audio API context to use
 * @returns {CrossfadeEngine} The CrossfadeEngine service instance
 */
export const getCrossfadeEngine = (audioContext) => {
  if (!instance) {
    instance = new CrossfadeEngine(audioContext);
  } else if (audioContext && instance.audioContext !== audioContext) {
    // Update audio context if it has changed
    instance.setAudioContext(audioContext);
  }
  
  return instance;
};

/**
 * Create a new CrossfadeEngine instance, replacing any existing one
 * @param {AudioContext} audioContext - Web Audio API context to use
 * @returns {CrossfadeEngine} A new CrossfadeEngine service instance
 */
export const createCrossfadeEngine = (audioContext) => {
  // Clean up existing instance if it exists
  if (instance) {
    instance.cleanup();
  }
  
  // Create new instance
  instance = new CrossfadeEngine(audioContext);
  return instance;
};

/**
 * Clean up and destroy the CrossfadeEngine instance
 */
export const destroyCrossfadeEngine = () => {
  if (instance) {
    instance.cleanup();
    instance = null;
  }
};

export default {
  getCrossfadeEngine,
  createCrossfadeEngine,
  destroyCrossfadeEngine
};