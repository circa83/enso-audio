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
  
  // Check if this session item is currently playing
  $: isCurrentTrack = (sessionItemId: string): boolean => {
    // First check if this session item ID matches the current session item ID
    const isCurrent = $currentSessionItemId === sessionItemId;
    
    // If we have a direct ID match AND it's playing, return true immediately
    if (isCurrent && $isPlaying) {
      return true;
    }
    
    // For the first-load case, check if the track in this session item is the same as the current playing track
    // This handles the case where a track is playing but its session item ID isn't set yet
    if ($isPlaying && $current && sessionItemId) {
      const sessionItemData = $session.find(item => item.id === sessionItemId);
      if (sessionItemData && sessionItemData.track.id === $current.id) {
        // We found a match by track ID - this is the currently playing track
        // We should also update the currentSessionItemId to keep things consistent
        if (!$currentSessionItemId) {
          console.log('SessionTracks.svelte - Updating currentSessionItemId to match playing track', sessionItemId);
          currentSessionItemId.set(sessionItemId);
        }
        return true;
      }
    }
    
    return false;
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
</script>

{#if $session.length > 0}
  <div class="mb-8">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-thin tracking-wider uppercase">Session</h2>
      <span class="text-xs text-enso-text-secondary uppercase tracking-wider">
        {$session.length} tracks
      </span>
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