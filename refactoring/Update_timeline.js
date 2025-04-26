// Add to useTimeline.js to better encapsulate timeline functionality
export function useTimeline() {
    const timelineContext = useTimelineContext();
    
    // Add these properties and methods to the returned object:
    return {
      // Existing properties...
      
      // Simpler API that includes state
      duration: timelineContext.sessionDuration,
      transitionDuration: timelineContext.transitionDuration,
      
      // Set duration with anti-recursion protection built in
      setDuration: (newDuration) => {
        // Implementation with protection against recursion
        timelineContext.setSessionDuration(newDuration);
      },
      
      // Set transition duration with anti-recursion protection built in
      setTransitionDuration: (newDuration) => {
        // Implementation with protection against recursion
        timelineContext.setTransitionDuration(newDuration);
      }
    };
  }
  