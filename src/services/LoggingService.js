/**
 * Centralized Logging Service for Enso Audio Dev
 * Provides configurable logging with different levels and categories
 */

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Log levels in order of verbosity (lowest to highest)
const LOG_LEVELS = {
  NONE: 0,    // No logging
  ERROR: 1,   // Only errors
  WARN: 2,    // Errors and warnings
  INFO: 3,    // Standard information
  DEBUG: 4,    // Detailed debug information
  TRACE: 5    // Most verbose level
};

// Default configuration
const DEFAULT_CONFIG = {
  level: process.env.NODE_ENV === 'production' ? LOG_LEVELS.ERROR : LOG_LEVELS.DEBUG,
  enabledCategories: '*', // All categories enabled by default
  disabledCategories: [], // No categories disabled by default
  useGroups: true,        // Use console.group when available
  showTimestamps: true,   // Show timestamps in logs
  colorize: isBrowser,    // Use colors in console (only in browser)
};

class LoggingService {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.categoryCache = {}; // Cache category enabling status
    
    // Initialize color schemes
    this.colors = {
      error: 'color: #ff5252; font-weight: bold',
      warn: 'color: #fb8c00; font-weight: bold',
      info: 'color: #2196f3',
      debug: 'color: #4caf50',
      trace: 'color: #9e9e9e',
      category: 'color: #3f51b5; font-weight: bold',
      timestamp: 'color: #9e9e9e; font-style: italic',
    };
  }

  /**
   * Configure the logging service
   * @param {Object} options - Configuration options
   */
  configure(options = {}) {
    this.config = { ...this.config, ...options };
    
    // Reset cache when configuration changes
    this.categoryCache = {};
    
    // Log the new configuration in debug mode
    if (this.config.level >= LOG_LEVELS.DEBUG) {
      this.debug('LoggingService', 'Logger reconfigured', this.config);
    }
    
    return this;
  }
  
  /**
   * Set the global logging level
   * @param {string|number} level - The log level to set
   */
  setLevel(level) {
    if (typeof level === 'string') {
      if (LOG_LEVELS[level.toUpperCase()] !== undefined) {
        this.config.level = LOG_LEVELS[level.toUpperCase()];
      } else {
        this.error('LoggingService', `Invalid log level: ${level}`);
      }
    } else if (typeof level === 'number') {
      if (level >= LOG_LEVELS.NONE && level <= LOG_LEVELS.TRACE) {
        this.config.level = level;
      } else {
        this.error('LoggingService', `Invalid log level number: ${level}`);
      }
    }
    
    return this;
  }
  
  /**
   * Enable logging for specific categories
   * @param {string|string[]} categories - Categories to enable
   */
  enableCategories(categories) {
    if (typeof categories === 'string') {
      if (categories === '*') {
        this.config.enabledCategories = '*';
      } else {
        if (this.config.enabledCategories !== '*') {
          if (!this.config.enabledCategories.includes(categories)) {
            this.config.enabledCategories.push(categories);
          }
        }
      }
    } else if (Array.isArray(categories)) {
      if (this.config.enabledCategories !== '*') {
        this.config.enabledCategories = [...new Set([
          ...this.config.enabledCategories,
          ...categories
        ])];
      }
    }
    
    // Reset cache
    this.categoryCache = {};
    
    return this;
  }
  
    /**
   * Disable logging for specific categories
   * @param {string|string[]} categories - Categories to disable
   */
    disableCategories(categories) {
        if (typeof categories === 'string') {
          if (categories === '*') {
            this.config.enabledCategories = [];
          } else if (!this.config.disabledCategories.includes(categories)) {
            this.config.disabledCategories.push(categories);
          }
        } else if (Array.isArray(categories)) {
          this.config.disabledCategories = [...new Set([
            ...this.config.disabledCategories,
            ...categories
          ])];
        }
        
        // Reset cache
        this.categoryCache = {};
        
        return this;
      }
      
      /**
       * Check if a category is enabled for logging
       * @param {string} category - Category to check
       * @returns {boolean} - Whether the category is enabled
       */
      isCategoryEnabled(category) {
        // Check cache first
        if (this.categoryCache[category] !== undefined) {
          return this.categoryCache[category];
        }
        
        let result = false;
        
        // Check if category is explicitly disabled
        if (this.config.disabledCategories.includes(category)) {
          result = false;
        }
        // Check if all categories are enabled
        else if (this.config.enabledCategories === '*') {
          result = true;
        }
        // Check if category is explicitly enabled
        else if (Array.isArray(this.config.enabledCategories) && 
                 this.config.enabledCategories.includes(category)) {
          result = true;
        }
        
        // Cache the result
        this.categoryCache[category] = result;
        return result;
      }
      
      /**
       * Format a log message
       * @param {string} level - Log level
       * @param {string} category - Log category
       * @param {string} message - Log message
       * @returns {Array} - Formatted log arguments
       */
      formatLogMessage(level, category, message, ...args) {
        const parts = [];
        const styles = [];
        
        // Add timestamp if enabled
        if (this.config.showTimestamps) {
          const timestamp = new Date().toISOString().split('T')[1].split('Z')[0];
          parts.push(`[${timestamp}]`);
          styles.push(this.colors.timestamp);
        }
        
        // Add level indicator
        parts.push(`[${level.toUpperCase()}]`);
        styles.push(this.colors[level.toLowerCase()] || '');
        
        // Add category
        if (category) {
          parts.push(`[${category}]`);
          styles.push(this.colors.category);
        }
        
        // Add message
        parts.push('%s');
        styles.push('');
        
        // Create format string - safely check for browser environment
        if (isBrowser && this.config.colorize && console.log) {
          // For browsers with color support
          return [
            parts.map((_, i) => i === parts.length - 1 ? '%s' : `%c${parts[i]}`).join(' '),
            ...styles.slice(0, -1),
            message,
            ...args
          ];
        } else {
          // For environments without color support or server-side
          return [parts.join(' '), message, ...args];
        }
      }
      
      /**
       * Log an error message
       * @param {string} category - Log category
       * @param {string} message - Log message
       * @param {...any} args - Additional arguments
       */
      error(category, message, ...args) {
        if (this.config.level >= LOG_LEVELS.ERROR && this.isCategoryEnabled(category)) {
          console.error(...this.formatLogMessage('error', category, message, ...args));
        }
        return this;
      }
      
      /**
       * Log a warning message
       * @param {string} category - Log category
       * @param {string} message - Log message
       * @param {...any} args - Additional arguments
       */
      warn(category, message, ...args) {
        if (this.config.level >= LOG_LEVELS.WARN && this.isCategoryEnabled(category)) {
          console.warn(...this.formatLogMessage('warn', category, message, ...args));
        }
        return this;
      }
      
      /**
       * Log an info message
       * @param {string} category - Log category
       * @param {string} message - Log message
       * @param {...any} args - Additional arguments
       */
      info(category, message, ...args) {
        if (this.config.level >= LOG_LEVELS.INFO && this.isCategoryEnabled(category)) {
          console.info(...this.formatLogMessage('info', category, message, ...args));
        }
        return this;
      }
      
      /**
       * Log a debug message
       * @param {string} category - Log category
       * @param {string} message - Log message
       * @param {...any} args - Additional arguments
       */
      debug(category, message, ...args) {
        if (this.config.level >= LOG_LEVELS.DEBUG && this.isCategoryEnabled(category)) {
          console.debug(...this.formatLogMessage('debug', category, message, ...args));
        }
        return this;
      }
      
      /**
       * Log a trace message (most verbose)
       * @param {string} category - Log category
       * @param {string} message - Log message
       * @param {...any} args - Additional arguments
       */
      trace(category, message, ...args) {
        if (this.config.level >= LOG_LEVELS.TRACE && this.isCategoryEnabled(category)) {
          console.log(...this.formatLogMessage('trace', category, message, ...args));
        }
        return this;
      }
      
      /**
       * Start a grouped log section
       * @param {string} category - Log category
       * @param {string} message - Group title
       * @param {string} level - Log level for the group
       */
      group(category, message, level = 'debug') {
        const logLevelValue = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.DEBUG;
        
        if (this.config.level >= logLevelValue && 
            this.isCategoryEnabled(category) && 
            this.config.useGroups && 
            isBrowser && console.group) {
          
          console.group(...this.formatLogMessage(level, category, message));
        }
        return this;
      }
      
      /**
       * End a grouped log section
       */
      groupEnd() {
        if (this.config.useGroups && isBrowser && console.groupEnd) {
          console.groupEnd();
        }
        return this;
      }
    }
    
    // Create singleton instance
    const logger = new LoggingService();
    
    // Export the constants and service
    export { LOG_LEVELS };
    export default logger;
    