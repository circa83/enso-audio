import { useState, useEffect, useCallback, useRef } from 'react';
import logger from '../services/LoggingService';
import PhaseManager from '../services/audio/PhaseManager';

/**
 * Hook for managing timeline phases
 * Follows Service > Hook > Component architecture by utilizing PhaseManager
 * 
 * @param {Object} options - Configuration options
 * @param {Object} [options.phaseManager] - Existing PhaseManager instance
 * @param {Object} [options.timeline] - Timeline hook instance for coordination
 * @param {Object} [options.crossfadeEngine] - CrossfadeEngine instance for transitions
 * @param {boolean} [options.editMode=false] - Whether edit mode is enabled
 * @param {boolean} [options.enableLogging=false] - Enable detailed logging
 * @returns {Object} Phase state and control functions
 */
export function usePhase(options = {}) {
  const {
    phaseManager: providedPhaseManager,
    timeline,
    crossfadeEngine,
    editMode: initialEditMode = false,
    enableLogging = false
  } = options;

  // State - React state that reflects PhaseManager state
  const [phases, setPhases] = useState([]);
  const [activePhaseId, setActivePhaseId] = useState(null);
  const [selectedPhaseId, setSelectedPhaseId] = useState(null); 
  const [editMode, setEditMode] = useState(initialEditMode);
  const [phaseCaptures, setPhaseCaptures] = useState({});

  // Refs
  const phaseManagerRef = useRef(providedPhaseManager || null);
  
  // Initialize the phase manager or connect to provided one
  useEffect(() => {
    if (enableLogging) logger.info('usePhase', 'Initializing phase hook');
    
    // If no PhaseManager is provided, create one
    if (!phaseManagerRef.current) {
      if (!crossfadeEngine) {
        logger.warn('usePhase', 'CrossfadeEngine required to create PhaseManager');
        return;
      }
      
      // Create PhaseManager with callbacks that update React state
      phaseManagerRef.current = new PhaseManager({
        crossfadeEngine,
        onPhaseChange: (phaseId, phaseData) => {
          setActivePhaseId(phaseId);
        },
        onMarkerSelection: (phaseId) => {
          setSelectedPhaseId(phaseId);
        },
        onMarkerDrag: () => {
          // Update phases state when markers are dragged
          if (phaseManagerRef.current) {
            setPhases(phaseManagerRef.current.getPhases());
          }
        },
        enableLogging
      });
      
      if (enableLogging) logger.info('usePhase', 'Created new PhaseManager instance');
    }
    
    // Initialize phases from PhaseManager or with defaults
    const manager = phaseManagerRef.current;
    if (manager) {
      // Get phases from manager
      const managerPhases = manager.getPhases();
      
      if (managerPhases.length > 0) {
        setPhases(managerPhases);
        if (enableLogging) logger.info('usePhase', `Loaded ${managerPhases.length} phases from PhaseManager`);
      } else {
        // Manager has no phases, initialize with defaults
        const defaultPhases = [
          { id: 'pre-onset', name: 'Pre-Onset', position: 0, color: '#4A6670', state: null, locked: true },
          { id: 'onset', name: 'Onset & Buildup', position: 20, color: '#6E7A8A', state: null, locked: false },
          { id: 'peak', name: 'Peak', position: 40, color: '#8A8A8A', state: null, locked: false },
          { id: 'return', name: 'Return & Integration', position: 60, color: '#A98467', state: null, locked: false }
        ];
        
        // Set phases in manager
        manager.setPhases(defaultPhases);
        setPhases(defaultPhases);
        
        if (enableLogging) logger.info('usePhase', 'Initialized default phases in PhaseManager');
      }
      
      // Set initial edit mode in manager
      if (initialEditMode) {
        manager.enterEditMode();
      } else {
        manager.exitEditMode();
      }
    }
    
    // Listen for phase changes from timeline or PhaseManager events
    const handlePhaseChange = (event) => {
      if (event.detail && event.detail.phaseId) {
        setActivePhaseId(event.detail.phaseId);
      }
    };
    
    const handleMarkerSelected = (event) => {
      if (event.detail && event.detail.phaseId) {
        setSelectedPhaseId(event.detail.phaseId);
      }
    };
    
    const handleMarkerDeselected = () => {
      setSelectedPhaseId(null);
    };
    
    const handleMarkerMoved = () => {
      // Update phases from manager to reflect new positions
      if (phaseManagerRef.current) {
        setPhases(phaseManagerRef.current.getPhases());
      }
    };
    
    const handleEditModeChanged = (event) => {
      if (event.detail && typeof event.detail.editMode === 'boolean') {
        setEditMode(event.detail.editMode);
      }
    };
    
    // Add event listeners
    window.addEventListener('timeline-phase-changed', handlePhaseChange);
    window.addEventListener('timeline-marker-selected', handleMarkerSelected);
    window.addEventListener('timeline-marker-deselected', handleMarkerDeselected);
    window.addEventListener('timeline-marker-moved', handleMarkerMoved);
    window.addEventListener('timeline-edit-mode-changed', handleEditModeChanged);
    
    // Cleanup
    return () => {
      window.removeEventListener('timeline-phase-changed', handlePhaseChange);
      window.removeEventListener('timeline-marker-selected', handleMarkerSelected);
      window.removeEventListener('timeline-marker-deselected', handleMarkerDeselected);
      window.removeEventListener('timeline-marker-moved', handleMarkerMoved);
      window.removeEventListener('timeline-edit-mode-changed', handleEditModeChanged);
    };
  }, [providedPhaseManager, crossfadeEngine, initialEditMode, enableLogging]);

  // Phase management methods - now delegate to PhaseManager
  const updatePhases = useCallback((newPhases) => {
    const manager = phaseManagerRef.current;
    if (!manager || !Array.isArray(newPhases)) return false;
    
    // Delegate to PhaseManager
    const success = manager.setPhases(newPhases);
    
    // Update React state if successful
    if (success) {
      setPhases(manager.getPhases());
    }
    
    return success;
  }, []);

  const selectPhase = useCallback((phaseId) => {
    const manager = phaseManagerRef.current;
    if (!manager) return false;
    
    if (enableLogging) logger.info('usePhase', `Selecting phase: ${phaseId}`);
    
    // Delegate to PhaseManager
    return manager.selectPhaseMarker(phaseId);
  }, [enableLogging]);

  const deselectPhase = useCallback(() => {
    const manager = phaseManagerRef.current;
    if (!manager) return false;
    
    if (enableLogging) logger.info('usePhase', 'Deselecting phase');
    
    // Delegate to PhaseManager
    return manager.deselectPhaseMarker();
  }, [enableLogging]);

  const updatePhasePosition = useCallback((phaseId, newPosition) => {
    const manager = phaseManagerRef.current;
    if (!manager) return false;
    
    // Delegate to PhaseManager
    const success = manager.updatePhaseMarkerPosition(phaseId, newPosition);
    
    // Update React state if successful
    if (success) {
      setPhases(manager.getPhases());
    }
    
    return success;
  }, []);

  const capturePhaseState = useCallback((phaseId) => {
    const manager = phaseManagerRef.current;
    if (!manager) return false;
    
    if (enableLogging) logger.info('usePhase', `Capturing state for phase: ${phaseId}`);
    
    // Get current state from timeline
    let currentState = {};
    
    if (timeline) {
      // Use refreshStateFromSources if available
      if (manager.refreshStateFromSources) {
        currentState = manager.refreshStateFromSources({
          volumeController: timeline.volume,
          layerController: timeline.layers
        });
      } else {
        // Manually build state
        currentState = {
          volumes: timeline.volumes ? { ...timeline.volumes } : {},
          activeAudio: timeline.layers && timeline.layers.active ? { ...timeline.layers.active } : {}
        };
      }
    }
    
    // Delegate to PhaseManager
    const success = manager.capturePhaseState(phaseId, currentState);
    
    // Update React state if successful
    if (success) {
      setPhases(manager.getPhases());
      
      // Update captures map
      const phase = manager.getPhase(phaseId);
      if (phase && phase.state) {
        setPhaseCaptures(current => ({
          ...current,
          [phaseId]: phase.state
        }));
      }
    }
    
    return success;
  }, [timeline, enableLogging]);

  const triggerPhase = useCallback((phaseId, options = {}) => {
    const manager = phaseManagerRef.current;
    if (!manager) return false;
    
    if (enableLogging) logger.info('usePhase', `Triggering phase: ${phaseId}`);
    
    // Delegate to PhaseManager
    return manager.triggerPhase(phaseId, options);
  }, [enableLogging]);

  const toggleEditMode = useCallback(() => {
    const manager = phaseManagerRef.current;
    if (!manager) return false;
    
    if (enableLogging) logger.info('usePhase', 'Toggling edit mode');
    
    // Delegate to PhaseManager based on current state
    if (editMode) {
      manager.exitEditMode();
    } else {
      manager.enterEditMode();
    }
    
    // Update local state
    setEditMode(!editMode);
    
    return true;
  }, [editMode, enableLogging]);

  // Return public API
  return {
    // State
    phases,
    activePhaseId,
    selectedPhaseId,
    editMode,
    phaseCaptures,
    
    // Methods
    updatePhases,
    selectPhase,
    deselectPhase,
    updatePhasePosition,
    capturePhaseState,
    triggerPhase,
    toggleEditMode,
    
    // Access to the PhaseManager service
    getPhaseManager: () => phaseManagerRef.current
  };
}

export default usePhase;
