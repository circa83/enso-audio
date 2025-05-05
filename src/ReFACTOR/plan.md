Services (TimelineEngine & PhaseManager):

Contain pure business logic
Are not dependent on React
Manage core state and calculations
Expose methods for state manipulation

Hooks (useTimeline & usePhase):

Provide React-friendly access to services
Handle React-specific concerns like state updates and callback stability
Abstract away service complexities
Return values and functions for components to use

Components (SessionTimeline & PhaseMarker):

Purely focused on visualization and user interaction
Don't contain business logic
Receive data as props and call functions for interactions
Primarily concerned with rendering and UI events
