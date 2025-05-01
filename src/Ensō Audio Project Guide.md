# Ensō Audio Project Guide

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture and Core Concepts](#architecture-and-core-concepts)
3. [File Structure and Responsibilities](#file-structure-and-responsibilities)
4. [Code Style Guide](#code-style-guide)
5. [Development Strategies](#development-strategies)
6. [Refactoring Roadmap](#refactoring-roadmap)
7. [Best Practices](#best-practices)

## Project Overview
Ensō Audio is a meditative audio application that allows users to experience layered soundscapes with dynamic transitions. The app focuses on seamless playback of audio tracks across multiple layers with timeline-based phase transitions.

### Primary Features
- Multi-layered audio playback
- Timeline-driven phase transitions
- Volume control for individual layers and master output
- Dynamic crossfading between audio tracks
- Collection-based content organization

## Architecture and Core Concepts

### Core Components
1. **Audio Layers**: The app uses 4 distinct audio layers (typically for drone, melody, rhythm, and nature sounds)
2. **Timeline**: A time-based progression that can trigger state changes at specific points
3. **Phases**: Predefined states in the timeline that configure track selection and volume levels
4. **Collections**: Groups of related audio tracks with metadata and configuration

### Key Technical Components
- **Audio Context**: Uses Web Audio API for audio processing
- **React Context**: Provides state management and audio functionality to components
- **Audio Services**: Handle specialized audio operations
- **Hooks**: Offer component-friendly interfaces to audio functionality

## File Structure and Responsibilities

### Critical Files

#### Core Implementation
- `src/contexts/StreamingAudioContext.js`: Primary audio state and functionality
- `src/services/audio/AudioCore.js`: Low-level audio context management
- `src/hooks/useAudio.js`: React hook for accessing audio functionality

#### Services
- `src/services/CollectionService.js`: Collection data fetching and processing
- `src/services/audio/BufferManager.js`: Audio buffer loading and caching
- `src/services/audio/TimelineEngine.js`: Timeline progression and phase management

#### Hooks
- `src/hooks/useCollections.js`: Collection data access
- `src/hooks/useAudio.js`: Unified audio API for components

#### Utilities
- `src/utils/audioUtils.js`: Common audio helper functions

## Code Style Guide

### Naming Conventions

#### Variables and Functions
- Use camelCase for variables and function names
- Be descriptive and avoid abbreviations unless widely understood
- Boolean variables should have "is", "has", or similar prefixes

```javascript
// Good
const isPlaying = false;
const handleStartPlayback = () => { /* ... */ };

// Avoid
const playing = false;
const start = () => { /* ... */ };
```

#### Component Names
- Use PascalCase for React components and context providers

```javascript
// Good
function AudioPlayerControls() { /* ... */ }
const AudioProvider = ({ children }) => { /* ... */ };

// Avoid
function audioPlayerControls() { /* ... */ }
```

#### Files
- Use PascalCase for component files
- Use camelCase for utility and service files
- Group related functionality in subdirectories

### Formatting
- Use 2-space indentation
- Limit line length to 80-100 characters
- Use trailing commas in multiline objects and arrays
- Place opening brackets on the same line as the statement

### Comments

#### Section Headers
Use section headers to organize large files:

```javascript
// ==================== INITIALIZATION ====================

// ==================== PLAYBACK CONTROLS ====================

// ==================== VOLUME MANAGEMENT ====================
```

#### Function Comments
Focus on explaining WHY, not just WHAT:

```javascript
/**
 * Crossfades between two audio tracks on the specified layer
 * 
 * This maintains continuous audio by gradually fading out the current
 * track while fading in the new one. The approach prevents sudden volume
 * changes that would break the meditative experience.
 * 
 * @param {string} layer - The target audio layer (e.g., 'Layer 1')
 * @param {string} trackId - The ID of the track to fade to
 * @param {number} [duration=1000] - Transition duration in milliseconds
 * @returns {Promise<boolean>} Success status
 */
```

### State Management
- Group related state values
- Use refs for values that don't trigger renders
- Keep state as close to its usage as possible

```javascript
// Group related state
const [audioState, setAudioState] = useState({
  isPlaying: false,
  currentTime: 0,
  duration: 60000
});

// For values that don't need to trigger renders
const audioElementsRef = useRef({});
```

### Error Handling
Use consistent error handling patterns:

```javascript
try {
  // Operation
  await loadAudioTrack(trackId);
} catch (error) {
  console.error(`Failed to load audio track ${trackId}: ${error.message}`);
  setError(`Could not load the selected sound: Please try again`);
}
```

### Logging
Keep logging simple and meaningful:

```javascript
// Before playing a track
console.log(`Playing track: ${trackId} on layer ${layer}`);

// When handling errors
console.error(`Failed to load collection: ${error.message}`);
```

## Development Strategies

### Breaking Down Large Files
1. **Add Section Headers**: First, organize with clear comments
2. **Extract Helper Functions**: Move reusable logic to separate functions
3. **Create Utility Files**: Move helpers to dedicated files when they form a cohesive group
4. **Document Interfaces**: Clearly document the inputs and outputs of extracted functions

### Improving Large Functions
1. **Single Responsibility**: Each function should do one thing well
2. **Maximum Length**: Aim for functions under 30 lines
3. **Extract Sub-Functions**: Break complex operations into steps
4. **Clear Return Values**: Be consistent with return types

Example of breaking down a large function:

```javascript
// BEFORE:
const loadCollection = async (id) => {
  // 100+ lines of code doing many things
};

// AFTER:
const loadCollection = async (id) => {
  try {
    await prepareForCollection(id);
    const collection = await fetchCollectionData(id);
    const formattedCollection = formatForPlayer(collection);
    await setupAudioElements(formattedCollection);
    applyCollectionConfig(formattedCollection);
    return true;
  } catch (error) {
    handleCollectionError(error);
    return false;
  }
};
```

## Refactoring Roadmap

### Phase 1: Preparation
1. Add section headers to large files
2. Improve comments on complex functions
3. Document the current architecture more thoroughly

### Phase 2: Simplification
1. Break down large functions in StreamingAudioContext.js
2. Extract utility functions to separate files
3. Simplify error handling and logging

### Phase 3: Standardization
1. Standardize similar operations across the codebase
2. Create reusable helper functions
3. Implement consistent patterns for common tasks

### Phase 4: Component Improvements
1. Simplify component rendering logic
2. Create more focused, specialized components
3. Improve UI state management

## Best Practices

### Audio Management
- Always manage audio loading states to prevent silent failures
- Handle audio context resuming on user interaction
- Use crossfades for all track changes
- Preload audio when possible for smoother transitions

### Performance
- Throttle frequent updates (like timeline progress)
- Avoid unnecessary re-renders in UI components
- Be mindful of memory usage with audio resources
- Clean up audio nodes when no longer needed

### State Management
- Keep track of active audio elements
- Use consistent state update patterns
- Prefer immutable updates for React state
- Use refs for values that don't need to trigger re-renders

### Error Recovery
- Have fallback content for failed audio loading
- Provide clear user feedback for errors
- Log enough information to diagnose issues
- Implement automatic retry for transient failures
