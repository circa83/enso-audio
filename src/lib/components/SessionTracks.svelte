<!-- // src/lib/components/SessionTracks.svelte -->
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
    const isCurrent = $currentSessionItemId === sessionItemId;
    const isPlayingNow = $isPlaying;
    return isCurrent && isPlayingNow;
  }
  
  function isInSession(trackId: string): boolean {
    return true; // All tracks in this component are in session
  }
  
  // Debug reactive updates
  $: console.log('SessionTracks - State:', { 
    currentSessionItemId: $currentSessionItemId, 
    isPlaying: $isPlaying,
    sessionCount: $session.length 
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