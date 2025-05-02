import logger, { LOG_LEVELS } from '../services/LoggingService';

/**
 * Configure logging for the application
 * @param {Object} options - Configuration options
 */
export function configureLogging(options = {}) {
  // Set default options based on environment
  const defaultOptions = {
    level: process.env.NODE_ENV === 'production' ? 'ERROR' : 'DEBUG',
    enabledCategories: '*',
    disabledCategories: [],
    // In production, disable verbose categories
    ...(process.env.NODE_ENV === 'production' ? {
      disabledCategories: ['TimelineManager', 'LayerManager', 'CollectionLoader']
    } : {})
  };
  
  // Merge with provided options
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Configure the logger
  logger.configure({
    level: LOG_LEVELS[mergedOptions.level] || LOG_LEVELS.DEBUG,
    enabledCategories: mergedOptions.enabledCategories,
    disabledCategories: mergedOptions.disabledCategories,
    useGroups: true,
    showTimestamps: true,
    colorize: true
  });
  
  // Log configuration in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    logger.group('LoggingService', 'Logging Configuration', 'info');
    logger.info('LoggingService', `Log Level: ${mergedOptions.level}`);
    logger.info('LoggingService', `Enabled Categories: ${
      mergedOptions.enabledCategories === '*' 
        ? 'ALL' 
        : mergedOptions.enabledCategories.join(', ')
    }`);
    
    if (mergedOptions.disabledCategories.length > 0) {
      logger.info('LoggingService', `Disabled Categories: ${mergedOptions.disabledCategories.join(', ')}`);
    }
    logger.groupEnd();
  }
  
  return logger;
}

/**
 * Get the current environment-appropriate log level
 */
export function getDefaultLogLevel() {
  // Use a more restrictive default in production
  if (process.env.NODE_ENV === 'production') {
    return 'ERROR';
  }
  
  // In development, we might want to read from localStorage or other config
  try {
    const savedLevel = localStorage.getItem('enso-log-level');
    if (savedLevel && LOG_LEVELS[savedLevel.toUpperCase()] !== undefined) {
      return savedLevel.toUpperCase();
    }
  } catch (e) {
    // Ignore localStorage errors
  }

   // Default to DEBUG in development
   return 'DEBUG';
}

/**
 * Save the current log level to localStorage
 * @param {string} level - The log level to save
 */
export function saveLogLevel(level) {
  if (typeof window !== 'undefined' && LOG_LEVELS[level.toUpperCase()] !== undefined) {
    try {
      localStorage.setItem('enso-log-level', level.toUpperCase());
    } catch (e) {
      // Ignore localStorage errors
    }
  }
}

// Export a pre-configured instance for direct imports
export const defaultLogger = configureLogging();