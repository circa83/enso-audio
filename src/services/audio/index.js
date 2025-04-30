/**
 * Ensō Audio Services
 * 
 * This module serves as the central export point for all audio services.
 * It provides a consistent interface for consuming components to access
 * the service functionality without needing to know the internal structure.
 */

// Import all service modules
import AudioCore from './AudioCore';
import BufferManager from './BufferManager';
import CrossfadeEngine from './CrossfadeEngine';
import VolumeController from './VolumeController';
import TimelineEngine from './TimelineEngine';


/**
 * Creates and initializes all required audio services
 * @param {Object} options - Global configuration options
 * @returns {Object} Object containing all initialized service instances
 */
export const createAudioServices = async (options = {}) => {
  // Initialize AudioCore first as other services depend on it
  const audioCore = new AudioCore(options.audioCore || {});
  await audioCore.initialize();
  
  // Get initialized context
  const audioContext = audioCore.getContext();
  const masterGain = audioCore.getMasterGain();
  
  // Initialize remaining services with proper dependencies
  const bufferManager = new BufferManager({
    audioContext,
    ...(options.bufferManager || {})
  });
  
  const volumeController = new VolumeController({
    audioContext,
    ...(options.volumeController || {})
  });
  
  const crossfadeEngine = new CrossfadeEngine({
    audioContext,
    destination: masterGain,
    ...(options.crossfadeEngine || {})
  });
  
  const timelineEngine = new TimelineEngine({
    ...(options.timelineEngine || {})
  });
  
  
  
  // Return all service instances
  return {
    audioCore,
    bufferManager,
    volumeController,
    crossfadeEngine,
    timelineEngine,
  
  };
};

// Export individual services for direct imports
export {
  AudioCore,
  BufferManager,
  CrossfadeEngine,
  VolumeController,
  TimelineEngine,

};

// Default export (for convenience)
export default {
  createAudioServices,
  AudioCore,
  BufferManager,
  CrossfadeEngine,
  VolumeController,

};