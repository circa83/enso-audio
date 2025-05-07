import React from 'react';
import appConfig from './appConfig';

/**
 * Simple component that conditionally renders children based on feature visibility
 * in appConfig
 * 
 * @param {Object} props Component properties
 * @param {string} props.featureId The feature identifier to check in appConfig
 * @param {React.ReactNode} props.children The content to render if feature is visible
 * @param {React.ReactNode} [props.fallback=null] Optional content to render if feature is hidden
 * @returns {JSX.Element|null} The rendered component or null
 */
const FeatureToggle = ({ featureId, children, fallback = null }) => {
  // Check if the feature should be visible according to appConfig
  const isVisible = appConfig.isFeatureVisible(featureId);
  
  // If the feature is visible, render the children
  if (isVisible) {
    return <>{children}</>;
  }
  
  // Otherwise, render the fallback or nothing
  return fallback ? <>{fallback}</> : null;
};

export default FeatureToggle;
