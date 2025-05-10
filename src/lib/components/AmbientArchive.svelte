<script lang="ts">
  import { current, session, addToSession, removeFromSession } from '$lib/player/store';
  import TrackCard from './archive/TrackCard.svelte';
  import type { Track } from '$lib/types/track';
  
  export let tracks: Track[] = [];
  export let showSessionControls = false;
  export let layout: 'list' | 'grid' | 'carousel' = 'list'; // For future use
  
  let expandedTrackId: string | null = null;
  let imageErrors: Record<string, boolean> = {};
  
  function handleTrackClick(track: Track) {
    console.log('AmbientArchive.svelte - handleTrackClick', track.title);
    if (expandedTrackId === track.id) {
      expandedTrackId = null;
    } else {
      expandedTrackId = track.id;
    }
  }
  
  function playNow(track: Track) {
    console.log('AmbientArchive.svelte - playNow', track.title);
    current.set(track);
    expandedTrackId = null;
  }
  
  function handleImageError(trackId: string) {
    console.error(`Failed to load image for track ${trackId}`);
    imageErrors[trackId] = true;
  }
  
  function isInSession(trackId: string): boolean {
    return $session.some(t => t.id === trackId);
  }
  
  function isCurrentTrack(trackId: string): boolean {
    return $current?.id === trackId;
  }
</script>

<!-- Archive container - layout prop ready for future layout implementations -->
<div class="ambient-archive" data-layout={layout}>
  {#if layout === 'list'}
    <div class="space-y-1">
      {#each tracks as track}
        <TrackCard
          {track}
          isPlaying={isCurrentTrack(track.id)}
          isSession={isInSession(track.id)}
          isExpanded={expandedTrackId === track.id}
          imageError={imageErrors[track.id] || false}
          onToggle={() => handleTrackClick(track)}
          onPlayNow={() => playNow(track)}
          onImageError={() => handleImageError(track.id)}
        />
      {/each}
    </div>
  {/if}
  
  <!-- Future layout implementations can be added here -->
  {#if layout === 'grid'}
    <!-- Grid layout will be implemented later -->
  {/if}
  
  {#if layout === 'carousel'}
    <!-- Carousel layout will be implemented later -->
  {/if}
</div>

<style>
  .ambient-archive {
    /* Base styles for the archive container */
  }
</style>