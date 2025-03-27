// src/components/common/CollapsibleSection.js
import React, { useState } from 'react';
import styles from '../../styles/components/CollapsibleSection.module.css';

const CollapsibleSection = ({ 
  title, 
  children, 
  initialExpanded = false,
  className = '',
  titleClassName = '',
  contentClassName = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  
  return (
    <div className={`${styles.sectionContainer} ${className}`}>
      <div 
        className={`${styles.sectionHeader} ${isExpanded ? styles.active : ''} ${titleClassName}`}
        onClick={() => setIsExpanded(!isExpanded)}
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