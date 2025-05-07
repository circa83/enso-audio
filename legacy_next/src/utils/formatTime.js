// src/utils/formatTime.js

/**
 * Format milliseconds into a time string (HH:MM:SS)
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted time string
 */
export const formatTime = (ms) => {
  // Guard against invalid input
  if (ms === undefined || ms === null || isNaN(ms)) {
    return '00:00:00';
  }
  
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  // Add leading zeros
  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(remainingSeconds).padStart(2, '0');
  
  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
};

/**
 * Format milliseconds into MM:SS format (no hours)
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted time string
 */
export const formatTimeMinutesSeconds = (ms) => {
  // Guard against invalid input
  if (ms === undefined || ms === null || isNaN(ms)) {
    return '00:00';
  }
  
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  // Add leading zeros
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');
  
  return `${formattedMinutes}:${formattedSeconds}`;
};

/**
 * Format milliseconds into a compact time string (omitting hours if zero)
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted time string (either MM:SS or HH:MM:SS)
 */
export const formatTimeCompact = (ms) => {
  // Guard against invalid input
  if (ms === undefined || ms === null || isNaN(ms)) {
    return '00:00';
  }
  
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  
  // If hours is 0, use MM:SS format
  if (hours === 0) {
    return formatTimeMinutesSeconds(ms);
  }
  
  // Otherwise use full HH:MM:SS format
  return formatTime(ms);
};

/**
 * Format milliseconds as a countdown (with negative sign for time remaining)
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted countdown string
 */
export const formatCountdown = (ms) => {
  // Guard against invalid input
  if (ms === undefined || ms === null || isNaN(ms)) {
    return '-00:00:00';
  }
  
  // Ensure positive value for formatting
  const positiveMs = Math.abs(ms);
  const formattedTime = formatTime(positiveMs);
  
  // Add negative sign for countdown
  return `-${formattedTime}`;
};

/**
 * Parse a time string (HH:MM:SS) into milliseconds
 * @param {string} timeString - Time string in format HH:MM:SS
 * @returns {number} Time in milliseconds
 */
export const parseTimeString = (timeString) => {
  if (!timeString || typeof timeString !== 'string') {
    return 0;
  }
  
  // Split by colons
  const parts = timeString.split(':');
  
  if (parts.length === 3) {
    // HH:MM:SS format
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
      return 0;
    }
    
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  } else if (parts.length === 2) {
    // MM:SS format
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    
    if (isNaN(minutes) || isNaN(seconds)) {
      return 0;
    }
    
    return (minutes * 60 + seconds) * 1000;
  }
  
  return 0;
};

/**
 * Format a timestamp from session progress percentage
 * @param {number} progress - Progress percentage (0-100)
 * @param {number} totalDuration - Total session duration in milliseconds
 * @returns {string} Formatted time string
 */
export const formatTimeFromProgress = (progress, totalDuration) => {
  if (progress === undefined || progress === null || isNaN(progress) ||
      totalDuration === undefined || totalDuration === null || isNaN(totalDuration)) {
    return '00:00:00';
  }
  
  // Calculate time in milliseconds
  const timeMs = (progress / 100) * totalDuration;
  return formatTime(timeMs);
};

/**
 * Format time remaining from current progress
 * @param {number} progress - Current progress (0-100)
 * @param {number} totalDuration - Total duration in milliseconds
 * @returns {string} Formatted time remaining
 */
export const formatTimeRemaining = (progress, totalDuration) => {
  if (progress === undefined || progress === null || isNaN(progress) ||
      totalDuration === undefined || totalDuration === null || isNaN(totalDuration)) {
    return '00:00:00';
  }
  
  // Calculate time remaining in milliseconds
  const timeRemainingMs = ((100 - progress) / 100) * totalDuration;
  return formatTime(timeRemainingMs);
};

/**
 * Convert between time units
 * @param {number} value - Time value to convert
 * @param {string} fromUnit - Source unit ('ms', 's', 'm', 'h')
 * @param {string} toUnit - Target unit ('ms', 's', 'm', 'h')
 * @returns {number} Converted time value
 */
export const convertTime = (value, fromUnit, toUnit) => {
  // Guard against invalid input
  if (value === undefined || value === null || isNaN(value)) {
    return 0;
  }
  
  // Convert to milliseconds first
  let ms = 0;
  switch (fromUnit) {
    case 'ms': ms = value; break;
    case 's': ms = value * 1000; break;
    case 'm': ms = value * 60000; break;
    case 'h': ms = value * 3600000; break;
    default: return 0;
  }
  
  // Convert from milliseconds to target unit
  switch (toUnit) {
    case 'ms': return ms;
    case 's': return ms / 1000;
    case 'm': return ms / 60000;
    case 'h': return ms / 3600000;
    default: return 0;
  }
};