<script lang="ts">
  import { session, current, isPlaying } from '$lib/player/store';
  import TrackList from './archive/TrackList.svelte';
  import type { Track } from '$lib/types/track';
  
  let expandedTrackId: string | null = null;
  let imageErrors: Record<string, boolean> = {};
  
  function handleTrackClick(track: Track) {
    console.log('SessionTracks.svelte - handleTrackClick', track.title);
    if (expandedTrackId === track.id) {
      expandedTrackId = null;
    } else {
      expandedTrackId = track.id;
    }
  }
  
  function playNow(track: Track) {
    console.log('SessionTracks.svelte - playNow', track.title);
    current.set(track);
    expandedTrackId = null;
  }
  
  function handleImageError(trackId: string) {
    console.error(`SessionTracks.svelte - Failed to load image for track ${trackId}`);
    imageErrors[trackId] = true;
  }
  
  // Make isCurrentTrack reactive by using $: 
  $: isCurrentTrack = (trackId: string): boolean => {
    const isCurrent = $current?.id === trackId;
    const isPlayingNow = $isPlaying;
    
    return isCurrent && isPlayingNow;
  }
  
  function isInSession(trackId: string): boolean {
    return true; // All tracks in this component are in session
  }
  
  // Debug reactive updates
  $: console.log('SessionTracks - State:', { 
    currentId: $current?.id, 
    isPlaying: $isPlaying,
    sessionCount: $session.length 
  });
</script>

{#if $session.length > 0}
  <div class="mb-8">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-thin tracking-wider uppercase">Session</h2>
      <span class="text-xs text-enso-text-secondary uppercase tracking-wider">
        {$session.length} tracks
      </span>
    </div>
    
    <TrackList
      tracks={$session}
      {expandedTrackId}
      {imageErrors}
      onTrackClick={handleTrackClick}
      {playNow}
      onImageError={handleImageError}
      {isCurrentTrack}
      {isInSession}
    />
  </div>
{/if}