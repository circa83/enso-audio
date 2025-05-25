<!-- src/lib/components/SessionTracks.svelte -->
<script lang="ts">
  import { session, current, currentSessionItemId, isPlaying } from '$lib/player/store';
  import ListTrackCard from './archive/ListTrackCard.svelte';
  import type { Track } from '$lib/types/track';
  import type { SessionItem } from '$lib/types/session';
  
  let expandedSessionItemId: string | null = null;
  let imageErrors: Record<string, boolean> = {};
  
  function handleTrackClick(sessionItem: SessionItem) {
    console.log('SessionTracks.svelte - handleTrackClick', sessionItem.track.title);
    if (expandedSessionItemId === sessionItem.id) {
      expandedSessionItemId = null;
    } else {
      expandedSessionItemId = sessionItem.id;
    }
  }
  
  function playNow(sessionItem: SessionItem) {
    console.log('SessionTracks.svelte - playNow', sessionItem.track.title);
    current.set(sessionItem.track);
    currentSessionItemId.set(sessionItem.id);
    expandedSessionItemId = null;
  }
  
  function handleImageError(trackId: string) {
    console.error(`SessionTracks.svelte - Failed to load image for track ${trackId}`);
    imageErrors[trackId] = true;
  }
  
  // Check if this session item is currently playing - FIXED VERSION
  $: isCurrentTrack = (sessionItemId: string): boolean => {
    // ONLY return true if this specific session item ID matches the current session item ID
    // AND the player is currently playing
    return $currentSessionItemId === sessionItemId && $isPlaying;
  };
  
  function isInSession(trackId: string): boolean {
    return true; // All tracks in this component are in session
  }
  
  // Debug reactive updates
  $: console.log('SessionTracks - State:', { 
    currentSessionItemId: $currentSessionItemId, 
    isPlaying: $isPlaying,
    sessionCount: $session.length,
    currentTrackId: $current?.id 
  });
  
  // Handle remove from session with session item ID
  function removeSessionItem(sessionItemId: string) {
    console.log('SessionTracks.svelte - removeSessionItem', sessionItemId);
    import('../player/store').then(({ removeFromSession }) => {
      removeFromSession(sessionItemId);
    });
  }
  
  // Format time for display
  function formatTime(seconds: number): string {
    if (!seconds && seconds !== 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  // Calculate total session duration
  $: totalDuration = $session.reduce((total, item) => {
    // Make sure to use the duration from the track object
    return total + (item.track.duration || 0);
  }, 0);
  
  // Log the duration calculation for debugging
  $: console.log('SessionTracks.svelte - Session duration calculation:', {
    totalDuration,
    tracks: $session.map(item => ({
      title: item.track.title,
      duration: item.track.duration
    }))
  });
</script>

{#if $session.length > 0}
  <div class="mb-8">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-thin tracking-wider uppercase">Session</h2>
      <div class="text-right">
        <span class="text-xs text-enso-text-secondary uppercase tracking-wider block">
          {$session.length} tracks : {formatTime(totalDuration)}
        </span>
      </div>
    </div>
    
    <div class="space-y-1">
      {#each $session as sessionItem}
        <ListTrackCard
          track={sessionItem.track}
          isPlaying={isCurrentTrack(sessionItem.id)}
          isSession={true}
          isExpanded={expandedSessionItemId === sessionItem.id}
          imageError={imageErrors[sessionItem.track.id] || false}
          onToggle={() => handleTrackClick(sessionItem)}
          onPlayNow={() => playNow(sessionItem)}
          onImageError={() => handleImageError(sessionItem.track.id)}
          sessionItemId={sessionItem.id}
        />
      {/each}
    </div>
  </div>
{/if}