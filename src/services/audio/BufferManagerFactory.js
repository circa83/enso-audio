/**
 * BufferManagerFactory.js
 * 
 * Factory for creating and managing BufferManager instances.
 * Manages access to the buffer manager service.
 */

import BufferManager from './BufferManager';

// Singleton instance
let instance = null;

/**
 * Get the BufferManager instance, creating it if it doesn't exist
 * @param {AudioContext} audioContext - Web Audio API context to use
 * @returns {BufferManager} The BufferManager service instance
 */
export const getBufferManager = (audioContext) => {
  if (!instance) {
    instance = new BufferManager(audioContext);
  } else if (audioContext && instance.audioContext !== audioContext) {
    // Update audio context if it has changed
    instance.setAudioContext(audioContext);
  }
  
  return instance;
};

/**
 * Create a new BufferManager instance, replacing any existing one
 * @param {AudioContext} audioContext - Web Audio API context to use
 * @returns {BufferManager} A new BufferManager service instance
 */
export const createBufferManager = (audioContext) => {
  // Clear existing instance if it exists
  if (instance) {
    instance.clearAllBuffers();
  }
  
  // Create new instance
  instance = new BufferManager(audioContext);
  return instance;
};

/**
 * Clean up and destroy the BufferManager instance
 */
export const destroyBufferManager = () => {
  if (instance) {
    instance.clearAllBuffers();
    instance = null;
  }
};

export default {
  getBufferManager,
  createBufferManager,
  destroyBufferManager
};