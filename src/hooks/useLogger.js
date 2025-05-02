import { useMemo } from 'react';
import logger from '../services/LoggingService';

/**
 * Hook for component-based logging
 * @param {string} category - Component or module name
 * @returns {Object} - Logger instance with category pre-defined
 */
export default function useLogger(category) {
  const componentLogger = useMemo(() => {
    return {
      error: (message, ...args) => logger.error(category, message, ...args),
      warn: (message, ...args) => logger.warn(category, message, ...args),
      info: (message, ...args) => logger.info(category, message, ...args),
      debug: (message, ...args) => logger.debug(category, message, ...args),
      trace: (message, ...args) => logger.trace(category, message, ...args),
      group: (message, level) => logger.group(category, message, level),
      groupEnd: () => logger.groupEnd()
    };
  }, [category]);
  
  return componentLogger;
}
