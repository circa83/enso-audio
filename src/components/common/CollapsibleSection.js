// src/components/common/ImprovedCollapsibleSection.js
import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/components/CollapsibleSection.module.css';

/**
 * CollapsibleSection - Reusable component for expandable/collapsible content
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Section title
 * @param {React.ReactNode} props.children - Content to display when expanded
 * @param {boolean} props.initialExpanded - Whether section starts expanded
 * @param {string} props.className - Additional CSS class for container
 * @param {string} props.titleClassName - Additional CSS class for title
 * @param {string} props.contentClassName - Additional CSS class for content
 * @param {Function} props.onExpand - Callback when section is expanded
 * @param {Function} props.onCollapse - Callback when section is collapsed
 */
const CollapsibleSection = React.memo(({ 
  title, 
  children, 
  initialExpanded = false,
  className = '',
  titleClassName = '',
  contentClassName = '',
  onExpand = null,
  onCollapse = null
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  
  // Call appropriate callback when expanded state changes
  useEffect(() => {
    if (isExpanded && onExpand) {
      onExpand();
    } else if (!isExpanded && onCollapse) {
      onCollapse();
    }
  }, [isExpanded, onExpand, onCollapse]);
  
  // Memoized toggle function
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prevState => !prevState);
  }, []);
  
  return (
    <div className={`${styles.sectionContainer} ${className}`}>
      <div 
        className={`${styles.sectionHeader} ${isExpanded ? styles.active : ''} ${titleClassName}`}
        onClick={toggleExpanded}
        role="button"
        aria-expanded={isExpanded}
        aria-controls={`collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpanded();
          }
        }}
      >
        <span className={styles.sectionTitle}>{title}</span>
        <span 
          className={styles.expandIcon} 
          aria-hidden="true"
        >
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>
      
      {isExpanded && (
        <div 
          className={`${styles.sectionContent} ${contentClassName}`}
          id={`collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
        >
          {children}
        </div>
      )}
    </div>
  );
});

// Add display name for debugging
CollapsibleSection.displayName = 'CollapsibleSection';

export default CollapsibleSection;