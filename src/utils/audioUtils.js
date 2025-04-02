// src/utils/audioUtils.js - Common audio utility functions

/**
 * Creates an audio buffer source node from a buffer
 * @param {AudioContext} audioContext - The Web Audio API context
 * @param {AudioBuffer} buffer - The audio buffer to use
 * @param {boolean} [loop=true] - Whether the source should loop
 * @returns {AudioBufferSourceNode} The created source node
 */
export const createBufferSource = (audioContext, buffer, loop = true) => {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    return source;
  };
  
  /**
   * Safely connects audio nodes with error handling
   * @param {AudioNode} sourceNode - Source audio node
   * @param {AudioNode} destinationNode - Destination audio node
   * @returns {boolean} Success status
   */
  export const safeConnect = (sourceNode, destinationNode) => {
    try {
      // Disconnect first to ensure clean connection
      try {
        sourceNode.disconnect(destinationNode);
      } catch (e) {
        // Ignore disconnection errors - node might not be connected yet
      }
      
      // Make the connection
      sourceNode.connect(destinationNode);
      return true;
    } catch (error) {
      console.error('Error connecting audio nodes:', error);
      return false;
    }
  };
  
  /**
   * Safely disconnects audio nodes with error handling
   * @param {AudioNode} node - The audio node to disconnect
   * @returns {boolean} Success status
   */
  export const safeDisconnect = (node) => {
    try {
      node.disconnect();
      return true;
    } catch (error) {
      console.error('Error disconnecting audio node:', error);
      return false;
    }
  };
  
  /**
   * Smoothly ramps a parameter to a target value
   * @param {AudioParam} param - The audio parameter to adjust
   * @param {number} value - Target value
   * @param {number} timeConstant - Time constant for the transition
   * @returns {boolean} Success status
   */
  export const smoothRamp = (param, value, timeConstant = 0.1) => {
    try {
      const now = param.context.currentTime;
      param.setTargetAtTime(value, now, timeConstant);
      return true;
    } catch (error) {
      console.error('Error setting parameter value:', error);
      // Fallback to immediate value change
      try {
        param.value = value;
        return true;
      } catch (e) {
        console.error('Fallback parameter setting failed:', e);
        return false;
      }
    }
  };
  
  /**
   * Creates a gain node with an initial value
   * @param {AudioContext} audioContext - The Web Audio API context
   * @param {number} initialGain - Initial gain value
   * @returns {GainNode} The created gain node
   */
  export const createGainNode = (audioContext, initialGain = 1) => {
    const gainNode = audioContext.createGain();
    gainNode.gain.value = initialGain;
    return gainNode;
  };
  
  /**
   * Safely starts audio playback with error handling
   * @param {HTMLAudioElement} audioElement - The audio element to play
   * @returns {Promise<boolean>} Success status
   */
  export const safePlay = async (audioElement) => {
    try {
      await audioElement.play();
      return true;
    } catch (error) {
      console.error('Error playing audio:', error);
      return false;
    }
  };
  
  /**
   * Safely pauses audio with error handling
   * @param {HTMLAudioElement} audioElement - The audio element to pause
   * @returns {boolean} Success status
   */
  export const safePause = (audioElement) => {
    try {
      audioElement.pause();
      return true;
    } catch (error) {
      console.error('Error pausing audio:', error);
      return false;
    }
  };
  
  /**
   * Calculate the volume in decibels from a linear value
   * @param {number} volume - Volume in linear scale (0-1)
   * @returns {number} Volume in decibels
   */
  export const linearToDecibels = (volume) => {
    // Avoid -Infinity by using a small value for 0
    if (volume < 0.001) return -60;
    return 20 * Math.log10(volume);
  };
  
  /**
   * Convert decibels to linear volume
   * @param {number} db - Volume in decibels
   * @returns {number} Volume in linear scale (0-1)
   */
  export const decibelsToLinear = (db) => {
    return Math.pow(10, db / 20);
  };
  
  /**
   * Log audio-related events to console with consistent formatting
   * @param {string} message - The message to log
   * @param {string} [level='info'] - Log level ('info', 'warn', 'error')
   * @param {string} [context='Audio'] - The context or component name
   */
  export const audioLog = (message, level = 'info', context = 'Audio') => {
    const prefix = `[${context}]`;
    
    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      case 'info':
      default:
        console.log(`${prefix} ${message}`);
        break;
    }
  };