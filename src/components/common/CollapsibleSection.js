// src/components/common/CollapsibleSection.js
import React, { useState, useEffect } from 'react';
import styles from '../../styles/components/CollapsibleSection.module.css';

const CollapsibleSection = ({ 
  title, 
  children, 
  initialExpanded = false,
  className = '',
  titleClassName = '',
  contentClassName = '',
  onExpand = null // New prop for callback when section is expanded
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  
  // Call onExpand callback when section is expanded
  useEffect(() => {
    if (isExpanded && onExpand) {
      onExpand();
    }
  }, [isExpanded, onExpand]);
  
  // Toggle expanded state
  const toggleExpanded = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
  };
  
  return (
    <div className={`${styles.sectionContainer} ${className}`}>
      <div 
        className={`${styles.sectionHeader} ${isExpanded ? styles.active : ''} ${titleClassName}`}
        onClick={toggleExpanded}
      >
        <span className={styles.sectionTitle}>{title}</span>
        <span className={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</span>
      </div>
      
      {isExpanded && (
        <div className={`${styles.sectionContent} ${contentClassName}`}>
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;