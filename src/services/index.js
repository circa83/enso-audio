/**
 * Service module exports
 * 
 * This file serves as the central export point for all services,
 * making them easier to import in other parts of the application.
 */

// Audio services
export { default as AudioCore } from './audio/AudioCore';
export { default as BufferManager } from './audio/BufferManager';
export { default as VolumeController } from './audio/VolumeController';
export { default as CrossfadeEngine } from './audio/CrossfadeEngine';
export { default as TimelineEngine } from './audio/TimelineEngine';


// Collection services
export { default as CollectionService } from './CollectionService';
export { default as AudioFileService } from './AudioFileService';

// Additional service exports can be added here as they are developed