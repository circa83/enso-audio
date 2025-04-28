# Ensō Audio Project Standards

## Application Architecture

### RULES TO FOLLOW: 

ALWAYS REMEMBER THE FOLLOWING RULES:
- Always ask for the file path before making any changes.
Examine the actual code in the provided context files carefully before responding. Focus only on what you can directly observe in the code. Quote specific relevant code snippets to support your explanations. Do not make assumptions about implementations you cannot see. If something is unclear or not visible in the provided context, explicitly acknowledge this limitation rather than inferring how it might work.
- Do not make any assumptions about the codebase or its architecture.
- Do not make any assumptions about the codebase or its architecture.
- Do not make any assumptions about the codebase or its architecture.
- Only offer updates to one file at a time before prompting for approval to continue. 
- When prompted, think deeply about the question and refer to the current state of the code base, be sure to update yourself before consulting the codebase, do not rely on your cached memory. 
- Before writing any code, ensure you have a clear understanding of the current architecture and design patterns, request the necessary context files for direct access for better understanding.
- Always examine the actual file content before proposing changes to ensure modifications align with current implementations.

### Component Hierarchy:

- UI Components (React components in src/components/)
- Hooks (Custom hooks in src/hooks/)
- Contexts (React contexts in src/contexts/)
- Services (Business logic in src/services/)

### React Implementation Patterns:

#### Component Patterns:
- Use functional components with hooks instead of class components
- Components should be named with PascalCase (e.g., `LayerControl`)
- Component files should match the component name (e.g., `LayerControl.js`)
- Use named exports for components that might be imported alongside others
- Use default exports for primary components in their own files

#### Hook Patterns:
- Custom hooks must be prefixed with "use" (e.g., `useCollection`)
- Hooks should directly destructure from contexts they use
- Hooks should return a memoized object with state and functions
- Hook dependencies should be carefully managed in useEffect/useCallback/useMemo

#### Context Patterns:
- Contexts should provide both state and methods to manipulate that state
- Context providers should be functional components, not classes
- State should be managed with useState/useReducer within context providers
- Use useRef for values that shouldn't trigger re-renders
- Contexts should expose service instances only when needed for advanced usage

#### Naming and Destructuring:
- Use direct destructuring from hook returns: `const { collections, isLoading } = useCollection()`
- Maintain consistent naming between context, hooks, and components
- Prefer explicit named exports for better code discovery

### Data Flow:

- One-way data flow: UI Components → Hooks → Contexts → Services
- Components should access data and methods exclusively through hooks
- Hooks should access context data through useContext hooks
- Contexts should manage state and interact with services
- Services should contain business logic and data manipulation

### Event Handling:

- Minimize direct EventBus usage in components and hooks
- Prefer direct method calls through hooks when possible
- Services may use EventBus for service-to-service communication
- Contexts may listen to service events to update state
- Use consistent event naming: `module:action` (e.g., `collection:loaded`)

### File Organization:

- /components/ - UI components organized by feature
  - /audio/ - Audio player components
  - /common/ - Shared UI components
  - /layout/ - Layout components
- /contexts/ - React context providers
- /hooks/ - Custom React hooks
- /services/ - Business logic services
- /utils/ - Utility functions
- /pages/ - Next.js pages
- /styles/ - CSS modules and global styles

## Audio Architecture

### Layer System:

- Audio is organized into 4 standard layers:
  - Layer 1 (Drone)
  - Layer 2 (Melody)
  - Layer 3 (Rhythm)
  - Layer 4 (Nature)
- Each layer has independent volume, mute, and track selection
- Each layer can have multiple variations of tracks
- Layer state should be managed through React contexts

### Buffer Management:

- Audio files are loaded via BufferService
- Buffers are cached with size limits to prevent memory issues
- Loading indicates progress via hooks
- Preloading is used to improve user experience
- Components should access buffer state through useBuffer hook

### Audio Playback:

- Web Audio API is used for all audio processing
- Crossfades use exponential ramps between sources
- Parameter changes use smoothRamp utility for clean transitions
- Audio timing uses the audioContext.currentTime clock
- Components should access audio state through useAudio hook

## Collection Architecture

### Collection Sources:

- Collections can be loaded from:
  - Local directory (public/collections/*)
- Source configuration is controlled through app config
- Source handlers abstract loading logic

### Collection Structure:

- Each collection has:
  - Metadata (id, name, description, etc.)
  - Cover image
  - Tracks organized by layers
  - Optional variations of tracks

### Collection API Pattern:

- Components should use useCollection() hook to access collections
- Direct destructuring pattern: `const { collections, loadCollections } = useCollection()`
- Navigation for collection selection should use Next.js router
- Collection formatting should happen through hook methods

## React Hooks and Contexts Pattern

### Hook Design Pattern:

- Hooks provide simplified API to underlying contexts
- Hooks should handle common use-cases without configuration
- Hooks should return memoized values and callbacks
- Hook naming: use[Feature] (useCollection, useAudio, etc.)
- Hooks should directly destructure from their contexts
- Hooks should not use EventBus directly except when necessary

```javascript
// Example pattern:
export function useCollection(options = {}) {
  const {
    // Direct destructuring from context
    collections,
    isLoading,
    loadCollections
  } = useCollectionContext();
  
  // Return memoized object
  return useMemo(() => ({
    collections,
    isLoading,
    loadCollections
  }), [collections, isLoading, loadCollections]);
}
```

### Context Design Pattern:

- Contexts manage state through useState/useReducer
- Contexts provide methods that update state
- Contexts instantiate and manage services
- Contexts update state after service method calls
- Contexts should handle error states from services

```javascript
// Example pattern:
export const CollectionProvider = ({ children }) => {
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const loadCollections = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await collectionService.getCollections();
      setCollections(result.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return (
    <CollectionContext.Provider value={{ 
      collections, 
      isLoading, 
      loadCollections 
    }}>
      {children}
    </CollectionContext.Provider>
  );
};
```

### Service Design Pattern:

- Services encapsulate business logic as classes
- Services are stateless or manage their own internal state
- Services may emit events but don't update UI state directly
- Services handle external resources (API, files, etc.)
- Services should use consistent logging format
- Services should provide cleanup methods

## Error Handling and Logging

### Error Handling:

- Services catch and log errors, then emit error events
- Contexts catch errors from services and update error state
- Components display user-friendly error messages
- Error events include detailed context for debugging

### Logging Standards:

- Use consistent log formats: [ModuleName] Message
- Log levels: error, warn, info
- Production builds minimize logging
- Prefix all logs with module name for easy filtering

## State Management

### Local Component State:

- For UI-specific temporary state (open/closed, hover, etc.)
- Managed with useState/useReducer

### Context State:

- For shared application state
- For state that persists across components
- Accessed via hooks that use useContext

### URL State:

- For shareable/bookmarkable state
- For routing-specific state
- Managed through Next.js router

## Performance Guidelines

### React Optimization:

- Use React.memo for pure components
- Use useMemo and useCallback for expensive computations/callbacks
- Use useRef for values that shouldn't trigger re-renders
- Properly manage dependencies in hooks to prevent unnecessary rerenders
- Destructure values from hooks directly, don't access via dot notation

### Audio Optimization:

- Buffer preloading for upcoming audio
- Cache management to limit memory usage
- Enable/disable audio nodes when not in use

### Loading States:

- Show loading indicators for operations >300ms
- Use progress indicators for buffer loading
- Implement placeholder UI where appropriate

This standards document reflects the actual architecture of Ensō Audio and should be consulted when developing new features or modifying existing code.
