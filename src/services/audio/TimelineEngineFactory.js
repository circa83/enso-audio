/**
 * TimelineEngineFactory.js
 * 
 * Factory for creating and managing TimelineEngine instances.
 * Provides access to the timeline engine service.
 */

import TimelineEngine from './TimelineEngine';

// Singleton instance
let instance = null;

/**
 * Get the TimelineEngine instance, creating it if it doesn't exist
 * @returns {TimelineEngine} The TimelineEngine service instance
 */
export const getTimelineEngine = () => {
  if (!instance) {
    instance = new TimelineEngine();
  }
  return instance;
};

/**
 * Create a new TimelineEngine instance, replacing any existing one
 * @returns {TimelineEngine} A new TimelineEngine service instance
 */
export const createTimelineEngine = () => {
  // Clean up existing instance if it exists
  if (instance) {
    instance.cleanup();
  }
  
  // Create new instance
  instance = new TimelineEngine();
  return instance;
};

/**
 * Clean up and destroy the TimelineEngine instance
 */
export const destroyTimelineEngine = () => {
  if (instance) {
    instance.cleanup();
    instance = null;
  }
};

export default {
  getTimelineEngine,
  createTimelineEngine,
  destroyTimelineEngine
};