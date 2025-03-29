/**
 * VolumeControllerFactory.js
 * 
 * Factory for creating and managing VolumeController instances.
 * Provides access to the volume controller service.
 */

import VolumeController from './VolumeController';

// Singleton instance
let instance = null;

/**
 * Get the VolumeController instance, creating it if it doesn't exist
 * @param {AudioContext} audioContext - Web Audio API context to use
 * @returns {VolumeController} The VolumeController service instance
 */
export const getVolumeController = (audioContext) => {
  if (!instance) {
    instance = new VolumeController(audioContext);
  } else if (audioContext && instance.audioContext !== audioContext) {
    // Update audio context if it has changed
    instance.setAudioContext(audioContext);
  }
  
  return instance;
};

/**
 * Create a new VolumeController instance, replacing any existing one
 * @param {AudioContext} audioContext - Web Audio API context to use
 * @returns {VolumeController} A new VolumeController service instance
 */
export const createVolumeController = (audioContext) => {
  // Clean up existing instance if it exists
  if (instance) {
    instance.cleanup();
  }
  
  // Create new instance
  instance = new VolumeController(audioContext);
  return instance;
};

/**
 * Clean up and destroy the VolumeController instance
 */
export const destroyVolumeController = () => {
  if (instance) {
    instance.cleanup();
    instance = null;
  }
};

export default {
  getVolumeController,
  createVolumeController,
  destroyVolumeController
};