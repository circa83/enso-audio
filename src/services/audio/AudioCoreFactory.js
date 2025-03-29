/**
 * AudioCoreFactory.js
 * 
 * Factory for creating and managing AudioCore instances.
 * Ensures we have a singleton instance of the audio core service.
 */

import AudioCore from './AudioCore';

// Singleton instance
let instance = null;

/**
 * Get the AudioCore instance, creating it if it doesn't exist
 * @returns {AudioCore} The AudioCore service instance
 */
export const getAudioCore = () => {
  if (!instance) {
    instance = new AudioCore();
  }
  return instance;
};

/**
 * Create a new AudioCore instance, replacing any existing one
 * @returns {AudioCore} A new AudioCore service instance
 */
export const createAudioCore = () => {
  // Clean up existing instance if it exists
  if (instance) {
    instance.cleanup();
  }
  
  // Create new instance
  instance = new AudioCore();
  return instance;
};

/**
 * Clean up and destroy the AudioCore instance
 */
export const destroyAudioCore = () => {
  if (instance) {
    instance.cleanup();
    instance = null;
  }
};

export default {
  getAudioCore,
  createAudioCore,
  destroyAudioCore
};