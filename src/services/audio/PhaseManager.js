/**
 * PhaseManager.js
 * 
 * Manages timeline phase functionality:
 * - Phase definitions and state
 * - Phase position calculation
 * - Phase change detection
 * - Phase transitions through CrossfadeEngine
 * - State provider registration
 * - State capture and application for phases
 * - Preset saving/loading
 * - Marker selection and interaction
 */
import logger from '../../services/LoggingService';

class PhaseManager {
  /**
   * Create a new PhaseManager instance
   * @param {Object} options - Configuration options
   * @param {CrossfadeEngine} options.crossfadeEngine - Crossfade engine instance
   * @param {Function} options.onPhaseChange - Callback for phase changes: (phaseId, phaseData) => void
   * @param {Array} [options.defaultPhases] - Initial phase configuration
   * @param {boolean} [options.enableLogging=false] - Enable detailed logging
   * @param {Function} [options.onMarkerSelection] - Callback for marker selection: (phaseId) => void
   * @param {Function} [options.onMarkerDrag] - Callback for marker drag: (phaseId, newPosition) => void
   * @param {number} [options.sessionDuration=3600000] - Session duration in milliseconds
   */
  constructor(options = {}) {
    // Dependencies
    this.crossfadeEngine = options.crossfadeEngine;
    
    if (!this.crossfadeEngine) {
      throw new Error('PhaseManager requires a CrossfadeEngine instance');
    }

    // Configuration
    this.config = {
      enableLogging: options.enableLogging || false,
      sessionDuration: options.sessionDuration || 3600000, // 1 hour default
      editMode: options.editMode || false
    };

    // Callbacks
    this.onPhaseChange = options.onPhaseChange || (() => {});
    this.onMarkerSelection = options.onMarkerSelection || (() => {});
    this.onMarkerDrag = options.onMarkerDrag || (() => {});
    this.onStateCapture = options.onStateCapture || (() => {});

    // Phase state
    this.phases = options.defaultPhases || [];
    this.currentPhase = null;
    this.selectedPhaseId = null;
    
    // Volume and audio state tracking
    this.volumeState = {};
    this.audioState = {};

    // State providers for presets
    this.stateProviders = {};

    this.logInfo('PhaseManager initialized');
  }

  /**
   * Set the timeline phases
   * @param {Array} phases - Phase configuration objects
   * @returns {boolean} Success state
   */
  setPhases(phases) {
    if (!Array.isArray(phases)) {
      this.logError('Invalid phases data (not an array)');
      return false;
    }

    try {
      this.logInfo(`Setting ${phases.length} timeline phases`);
      
      // Sort phases by position
      this.phases = [...phases].sort((a, b) => a.position - b.position);
      
      // Check current phase after updating
      this.checkCurrentPhase();
      
      // Dispatch phases updated event
      this.dispatchEvent('timeline-phases-updated', {
        phases: this.phases
      });
      
      return true;
    } catch (error) {
      this.logError(`Error setting phases: ${error.message}`);
      return false;
    }
  }

  /**
   * Get all configured phases
   * @returns {Array} Phase configuration objects
   */
  getPhases() {
    return [...this.phases];
  }

  /**
   * Get a specific phase by ID
   * @param {string} phaseId - Phase identifier
   * @returns {Object|null} Phase configuration or null if not found
   */
  getPhase(phaseId) {
    return this.phases.find(p => p.id === phaseId) || null;
  }

  /**
   * Get the current active phase
   * @returns {Object|null} Current phase or null if none active
   */
  getCurrentPhase() {
    return this.currentPhase;
  }

  /**
   * Update a specific phase's properties
   * @param {string} phaseId - Phase identifier
   * @param {Object} updates - Properties to update
   * @returns {boolean} Success state
   */
  updatePhase(phaseId, updates) {
    const phaseIndex = this.phases.findIndex(p => p.id === phaseId);
    if (phaseIndex === -1) {
      this.logError(`Phase not found: ${phaseId}`);
      return false;
    }

    try {
      // Create a copy of the phase
      const updatedPhase = { ...this.phases[phaseIndex], ...updates };
      
      // Enforce position constraints based on neighbors if position is being updated
      if ('position' in updates) {
        // Ensure phase remains in order (lock between previous and next phases)
        const lowerBound = phaseIndex > 0 ? this.phases[phaseIndex - 1].position + 1 : 0;
        const upperBound = phaseIndex < this.phases.length - 1 ? this.phases[phaseIndex + 1].position - 1 : 100;
        
        // Clamp the position
        updatedPhase.position = Math.max(lowerBound, Math.min(upperBound, updatedPhase.position));
      }

      // Update the phase
      this.phases[phaseIndex] = updatedPhase;
      
      // Re-sort phases by position
      this.phases.sort((a, b) => a.position - b.position);
      
      this.logInfo(`Updated phase ${phaseId}`, updates);
      
      // Check if the updated phase is current
      if (this.currentPhase && this.currentPhase.id === phaseId) {
        this.currentPhase = updatedPhase;
      }
      
      // Dispatch phase updated event
      this.dispatchEvent('timeline-phase-updated', {
        phaseId: phaseId,
        phase: updatedPhase
      });
      
      return true;
    } catch (error) {
      this.logError(`Error updating phase ${phaseId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Set a phase's state (volumes and track configuration)
   * @param {string} phaseId - Phase identifier
   * @param {Object} state - Phase state data
   * @returns {boolean} Success state
   */
  setPhaseState(phaseId, state) {
    const phaseIndex = this.phases.findIndex(p => p.id === phaseId);
    if (phaseIndex === -1) {
      this.logError(`Phase not found: ${phaseId}`);
      return false;
    }

    try {
      this.logInfo(`Setting state for phase ${phaseId}`);
      
      // Update phase state
      this.phases[phaseIndex].state = { ...state };
      
      // If this is the current phase, update state references
      if (this.currentPhase && this.currentPhase.id === phaseId) {
        this.currentPhase.state = { ...state };
        
        // Update our volume and audio state tracking
        if (state.volumes) {
          this.volumeState = { ...state.volumes };
        }
        
        if (state.activeAudio) {
          this.audioState = { ...state.activeAudio };
        }
      }
      
      // Dispatch phase state updated event
      this.dispatchEvent('timeline-phase-state-updated', {
        phaseId: phaseId,
        state: state
      });
      
      return true;
    } catch (error) {
      this.logError(`Error setting phase state for ${phaseId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Capture current audio state for a phase
   * @param {string} phaseId - Phase identifier
   * @param {Object} currentState - Current audio system state
   * @param {Object} currentState.volumes - Current volume levels by layer
   * @param {Object} currentState.activeAudio - Current active tracks by layer
   * @returns {boolean} Success state
   */
  capturePhaseState(phaseId, currentState) {
    const phaseIndex = this.phases.findIndex(p => p.id === phaseId);
    if (phaseIndex === -1) {
      this.logError(`Phase not found: ${phaseId}`);
      return false;
    }

    try {
      this.logInfo(`Capturing current state for phase ${phaseId}`);
      
      // Create state object from current volumes and tracks
      const state = {
        volumes: { ...currentState.volumes },
        activeAudio: { ...currentState.activeAudio }
      };
      
      // Update the phase
      this.phases[phaseIndex].state = state;
      this.phases[phaseIndex].hasStateCaptured = true;
      
      // If this is the current phase, update current state references
      if (this.currentPhase && this.currentPhase.id === phaseId) {
        this.currentPhase.state = { ...state };
        this.currentPhase.hasStateCaptured = true;
        this.volumeState = { ...state.volumes };
        this.audioState = { ...state.activeAudio };
      }
      
      this.logInfo(`Captured state for phase ${phaseId}`, state);
      
      // Dispatch state captured event
      this.dispatchEvent('timeline-phase-state-captured', {
        phaseId: phaseId,
        state: state
      });
      
      return true;
    } catch (error) {
      this.logError(`Error capturing phase state for ${phaseId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Check which phase should be active based on timeline position
   * @param {number} progress - Current timeline progress percentage
   * @param {boolean} [forceUpdate=false] - Force update even if phase hasn't changed
   * @returns {Object|null} Newly active phase or null if no change
   */
  checkCurrentPhase(progress, forceUpdate = false) {
    if (this.phases.length === 0) {
      return null;
    }

    try {
      // Find the last phase whose position is less than or equal to current position
      let newPhase = null;
      for (let i = this.phases.length - 1; i >= 0; i--) {
        if (this.phases[i].position <= progress) {
          newPhase = this.phases[i];
          break;
        }
      }

      // If no phase is found (shouldn't happen with proper config), use the first phase
      if (!newPhase && this.phases.length > 0) {
        newPhase = this.phases[0];
      }

      // If no phase change, or no phase found, return
      if (!newPhase || (!forceUpdate && this.currentPhase && newPhase.id === this.currentPhase.id)) {
        return null;
      }

      this.logInfo(`Phase changed to: ${newPhase.id} at ${progress ? progress.toFixed(2) : '?'}%`);
      
      // Update current phase
      this.currentPhase = newPhase;
      
      // If the new phase has state, trigger a phase transition to apply it
      if (newPhase.state) {
        if (this.crossfadeEngine.isTransitioning()) {
          // Queue the transition if one is already in progress
          this.crossfadeEngine.queueTransition(newPhase.id, newPhase.state);
        } else {
          // Start transition to new phase
          this.crossfadeEngine.startTransition(newPhase.id, newPhase.state);
        }
      }
      
      // Notify of phase change regardless of state
      if (this.onPhaseChange) {
        this.onPhaseChange(newPhase.id, newPhase.state || {});
      }
      
      // Dispatch phase change event
      this.dispatchEvent('timeline-phase-changed', {
        phaseId: newPhase.id,
        phaseData: newPhase,
        state: newPhase.state || {},
        progress: progress
      });

      return newPhase;
    } catch (error) {
      this.logError(`Error checking current phase: ${error.message}`);
      return null;
    }
  }
  triggerPhase(phaseId, options = {}) {
    const phase = this.getPhase(phaseId);
    if (!phase) {
      this.logError(`Cannot trigger phase: Phase ${phaseId} not found`);
      return false;
    }

    try {
      this.logInfo(`Manually triggering phase: ${phaseId}`, options);
      
      // Update current phase
      this.currentPhase = phase;
      
      // If immediate mode requested or phase has no state, just notify of change
      if (options.immediate || !phase.state) {
        this.logInfo(`Applying phase ${phaseId} immediately (no transition)`);
        
        // Update state references
        if (phase.state) {
          if (phase.state.volumes) {
            this.volumeState = { ...phase.state.volumes };
          }
          
          if (phase.state.activeAudio) {
            this.audioState = { ...phase.state.activeAudio };
          }
        }
        
        if (this.onPhaseChange) {
          this.onPhaseChange(phase.id, phase.state || {});
        }
        
        // Dispatch immediate phase change event
        this.dispatchEvent('timeline-phase-changed', {
          phaseId: phase.id,
          phaseData: phase,
          state: phase.state || {},
          immediate: true
        });
        
        return true;
      }
      
      // Otherwise start a transition using the CrossfadeEngine
      return this.crossfadeEngine.startTransition(phaseId, phase.state, options);
    } catch (error) {
      this.logError(`Error triggering phase ${phaseId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Handle phase marker selection
   * @param {string} phaseId - Phase identifier
   * @returns {boolean} Success state
   */
  selectPhaseMarker(phaseId) {
    try {
      const phase = this.getPhase(phaseId);
      if (!phase) {
        this.logError(`Cannot select phase: ${phaseId} not found`);
        return false;
      }
      
      this.logInfo(`Selecting phase marker: ${phaseId}`);
      
      // Record selected phase
      this.selectedPhaseId = phaseId;
      
      // Call selection callback if provided
      if (this.onMarkerSelection) {
        this.onMarkerSelection(phaseId, phase);
      }
      
      // Dispatch marker selection event
      this.dispatchEvent('timeline-marker-selected', {
        phaseId,
        phase
      });
      
      return true;
    } catch (error) {
      this.logError(`Error selecting phase marker ${phaseId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Handle phase marker deselection
   * @returns {boolean} Success state
   */
  deselectPhaseMarker() {
    try {
      if (!this.selectedPhaseId) {
        return true; // Nothing to deselect
      }
      
      this.logInfo(`Deselecting phase marker: ${this.selectedPhaseId}`);
      
      const previousPhaseId = this.selectedPhaseId;
      this.selectedPhaseId = null;
      
      // Dispatch marker deselection event
      this.dispatchEvent('timeline-marker-deselected', {
        phaseId: previousPhaseId
      });
      
      return true;
    } catch (error) {
      this.logError(`Error deselecting phase marker: ${error.message}`);
      return false;
    }
  }

  /**
   * Handle phase marker position change (drag)
   * @param {string} phaseId - Phase identifier
   * @param {number} newPosition - New position (0-100)
   * @returns {boolean} Success state
   */
  updatePhaseMarkerPosition(phaseId, newPosition) {
    try {
      const phaseIndex = this.phases.findIndex(p => p.id === phaseId);
      if (phaseIndex === -1) {
        this.logError(`Phase not found: ${phaseId}`);
        return false;
      }
      
      // Check if phase is locked
      if (this.phases[phaseIndex].locked) {
        this.logInfo(`Phase ${phaseId} is locked, cannot move`);
        return false;
      }
      
      // Enforce position constraints based on neighbors
      const lowerBound = phaseIndex > 0 ? this.phases[phaseIndex - 1].position + 1 : 0;
      const upperBound = phaseIndex < this.phases.length - 1 ? this.phases[phaseIndex + 1].position - 1 : 100;
      
      // Clamp the position
      const clampedPosition = Math.max(lowerBound, Math.min(upperBound, newPosition));
      
      this.logInfo(`Moving phase marker ${phaseId} to position ${clampedPosition}`);
      
      // Update phase position
      this.phases[phaseIndex].position = clampedPosition;
      
      // Re-sort phases by position
      this.phases.sort((a, b) => a.position - b.position);
      
      // Call marker drag callback if provided
      if (this.onMarkerDrag) {
        this.onMarkerDrag(phaseId, clampedPosition);
      }
      
      // Dispatch marker moved event
      this.dispatchEvent('timeline-marker-moved', {
        phaseId,
        position: clampedPosition
      });
      
      return true;
    } catch (error) {
      this.logError(`Error updating phase marker position for ${phaseId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Enter edit mode for phase markers
   * @returns {boolean} Success state
   */
  enterEditMode() {
    try {
      this.logInfo('Entering edit mode for phase markers');
      
      this.config.editMode = true;
      
      // Deselect any selected marker
      this.deselectPhaseMarker();
      
      // Dispatch edit mode entered event
      this.dispatchEvent('timeline-edit-mode-changed', {
        editMode: true
      });
      
      return true;
    } catch (error) {
      this.logError(`Error entering edit mode: ${error.message}`);
      return false;
    }
  }

  /**
   * Exit edit mode for phase markers
   * @returns {boolean} Success state
   */
  exitEditMode() {
    try {
      this.logInfo('Exiting edit mode for phase markers');
      
      this.config.editMode = false;
      
      // Deselect any selected marker
      this.deselectPhaseMarker();
      
      // Dispatch edit mode exited event
      this.dispatchEvent('timeline-edit-mode-changed', {
        editMode: false
      });
      
      return true;
    } catch (error) {
      this.logError(`Error exiting edit mode: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if a phase has captured state
   * @param {string} phaseId - Phase identifier
   * @returns {boolean} True if phase has state
   */
  hasPhaseStateCaptured(phaseId) {
    const phase = this.getPhase(phaseId);
    if (!phase) return false;
    
    return !!(phase.state && (
      (phase.state.volumes && Object.keys(phase.state.volumes).length > 0) ||
      (phase.state.activeAudio && Object.keys(phase.state.activeAudio).length > 0)
    ));
  }

  /**
   * Register a state provider for presets
   * @param {string} providerId - Provider identifier
   * @param {Function} providerFn - Function that returns state object
   * @returns {boolean} Success state
   */
  registerStateProvider(providerId, providerFn) {
    if (!providerId || typeof providerFn !== 'function') {
      this.logError('Invalid state provider', { providerId, type: typeof providerFn });
      return false;
    }
    
    this.stateProviders[providerId] = providerFn;
    this.logInfo(`Registered state provider: ${providerId}`);
    return true;
  }

  /**
   * Get full state for preset generation
   * Matches original method name for compatibility
   * @returns {Object} Full state object
   */
  getFullState() {
    try {
      const state = {
        phases: this.phases.map(phase => ({
          id: phase.id,
          name: phase.name,
          position: phase.position,
          color: phase.color,
          state: phase.state,
          locked: phase.locked
        })),
        timestamp: Date.now()
      };
      
      // Collect data from state providers
      for (const [providerId, providerFn] of Object.entries(this.stateProviders)) {
        try {
          state[providerId] = providerFn();
        } catch (error) {
          this.logError(`Error getting state from provider ${providerId}: ${error.message}`);
        }
      }
      
      this.logInfo('Generated full state from current configuration');
      return state;
    } catch (error) {
      this.logError(`Error generating full state: ${error.message}`);
      return { phases: this.phases, timestamp: Date.now() };
    }
  }

  
  /**
   * Update current volume state
   * @param {Object} volumes - Volume levels by layer
   */
  updateVolumeState(volumes) {
    this.volumeState = { ...volumes };
  }

  /**
   * Update current audio state
   * @param {Object} audioState - Active tracks by layer
   */
  updateAudioState(audioState) {
    this.audioState = { ...audioState };
  }

  /**
   * Get current volume state
   * @returns {Object} Volume levels by layer
   */
  getVolumeState() {
    return { ...this.volumeState };
  }

  /**
   * Get current audio state
   * @returns {Object} Active tracks by layer
   */
  getAudioState() {
    return { ...this.audioState };
  }


/**
 * Refresh state from external volume and audio controllers
 * @param {Object} options - Refresh options
 * @param {Object} options.volumeController - Volume controller to get state from
 * @param {Object} options.layerController - Layer controller to get state from
 * @returns {Object} Current state object
 */
refreshStateFromSources(options = {}) {
    const { volumeController, layerController } = options;
    
    try {
      this.logInfo('Refreshing state from external controllers');
      
      // Get current volume state if volumeController provided
      if (volumeController && volumeController.layers) {
        const updatedVolumes = {};
        Object.entries(volumeController.layers).forEach(([layer, vol]) => {
          // Round to avoid floating point issues
          updatedVolumes[layer] = Math.round(vol * 100) / 100;
        });
        
        this.volumeState = updatedVolumes;
      }
      
      // Get current audio state if layerController provided
      if (layerController && layerController.active) {
        const updatedAudio = {};
        Object.entries(layerController.active).forEach(([layer, trackId]) => {
          if (trackId) {
            updatedAudio[layer] = trackId;
          }
        });
        
        this.audioState = updatedAudio;
      }
      
      this.logInfo('State refreshed from external sources');
      
      return {
        volumes: { ...this.volumeState },
        activeAudio: { ...this.audioState }
      };
    } catch (error) {
      this.logError(`Error refreshing state from sources: ${error.message}`);
      return {
        volumes: { ...this.volumeState },
        activeAudio: { ...this.audioState }
      };
    }
  }
  
  /**
   * Apply the pre-onset phase immediately
   * @param {Object} options - Application options
   * @param {Object} options.volumeController - Volume controller to apply to
   * @param {Object} options.transitionController - Transition controller to apply to
   * @returns {boolean} Success state
   */
  applyPreOnsetPhase(options = {}) {
    const { volumeController, transitionController } = options;
    
    try {
      this.logInfo('Applying pre-onset phase immediately');
      
      // Find the pre-onset phase
      const preOnsetPhase = this.phases.find(p => p.id === 'pre-onset');
      
      if (!preOnsetPhase) {
        this.logWarn('No pre-onset phase defined');
        return false;
      }
      
      // Set pre-onset as the current phase
      this.currentPhase = preOnsetPhase;
      
      // If pre-onset has state, apply it immediately
      if (preOnsetPhase.state) {
        this.logInfo('Found pre-onset phase with saved state');
        
        // Apply volumes immediately if provided
        if (preOnsetPhase.state.volumes && volumeController) {
          Object.entries(preOnsetPhase.state.volumes).forEach(([layer, vol]) => {
            this.logInfo(`Setting ${layer} volume to ${vol}`);
            volumeController.setVolume(layer, vol, { immediate: true });
          });
          
          // Update volumeState
          this.volumeState = { ...preOnsetPhase.state.volumes };
        }
        
        // Apply audio tracks with minimal crossfade if provided
        if (preOnsetPhase.state.activeAudio && transitionController) {
          Object.entries(preOnsetPhase.state.activeAudio).forEach(([layer, trackId]) => {
            this.logInfo(`Switching ${layer} to track ${trackId}`);
            transitionController.crossfade(layer, trackId, 50); // Use minimal crossfade to prevent pops
          });
          
          // Update audioState
          this.audioState = { ...preOnsetPhase.state.activeAudio };
        }
        
        // Dispatch event for phase change
        this.dispatchEvent('timeline-phase-changed', {
          phaseId: preOnsetPhase.id,
          phaseData: preOnsetPhase,
          state: preOnsetPhase.state,
          immediate: true
        });
        
        return true;
      } else {
        this.logInfo('Pre-onset phase has no state, using defaults');
        return false;
      }
    } catch (error) {
      this.logError(`Error applying pre-onset phase: ${error.message}`);
      return false;
    }
  }
  


  /**
   * Convert time position to percentage
   * @param {number} timeMs - Time in milliseconds
   * @returns {number} Percentage position (0-100)
   */
  timeToPercent(timeMs) {
    return Math.min(100, Math.max(0, (timeMs / this.config.sessionDuration) * 100));
  }

  /**
   * Convert percentage to time position
   * @param {number} percent - Percentage position (0-100)
   * @returns {number} Time in milliseconds
   */
  percentToTime(percent) {
    return Math.min(this.config.sessionDuration, Math.max(0, (percent / 100) * this.config.sessionDuration));
  }



  /**
   * Dispatch a custom event
   * @param {string} eventName - Name of the event
   * @param {Object} detail - Event details
   * @private
   */
  dispatchEvent(eventName, detail) {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent(eventName, { detail });
      window.dispatchEvent(event);
    }
  }
  
  /**
   * Log a debug message
   * @private
   * @param {string} message - Message to log
   * @param {Object} [data] - Optional data to log
   */
  logDebug(message, data) {
    if (this.config.enableLogging) {
      if (data) {
        logger.debug('PhaseManager', message, data);
      } else {
        logger.debug('PhaseManager', message);
      }
    }
  }
  
  /**
   * Log an info message
   * @private
   * @param {string} message - Message to log
   * @param {Object} [data] - Optional data to log
   */
  logInfo(message, data) {
    if (this.config.enableLogging) {
      if (data) {
        logger.info('PhaseManager', message, data);
      } else {
        logger.info('PhaseManager', message);
      }
    }
  }
  
  /**
   * Log a warning message
   * @private
   * @param {string} message - Message to log
   * @param {Object} [data] - Optional data to log
   */
  logWarn(message, data) {
    if (this.config.enableLogging) {
      if (data) {
        logger.warn('PhaseManager', message, data);
      } else {
        logger.warn('PhaseManager', message);
      }
    }
  }
  
  /**
   * Log an error message
   * @private
   * @param {string} message - Message to log
   * @param {Object} [data] - Optional data to log
   */
  logError(message, data) {
    if (this.config.enableLogging) {
      if (data) {
        logger.error('PhaseManager', message, data);
      } else {
        logger.error('PhaseManager', message);
      }
    }
  }
}

export default PhaseManager;
