<!-- src/lib/components/AmbientArchive.svelte -->
<script lang="ts">
  import { current, session, addToSession, removeFromSession } from '$lib/player/store';
  import TrackList from './archive/TrackList.svelte';
  import TrackGrid from './archive/TrackGrid.svelte';
  import TrackCarousel from './archive/TrackCarousel.svelte';
  import type { Track } from '$lib/types/track';
  
  export let tracks: Track[] = [];
  export let showSessionControls = false;
  export let layout: 'list' | 'grid' | 'carousel' = 'grid';
  export let title: string = 'Ambient Archive';
  export let subtitle: string = 'Curated collection of ambient tracks';
  
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
  
  // Fixed function to correctly check if a track is in the session
  function isInSession(trackId: string): boolean {
    return $session.some(item => item.track.id === trackId);
  }
  
  function isCurrentTrack(trackId: string): boolean {
    // For the Ambient Archive, we don't want to show playing indicators
    // Always return false
    return false;
  }
</script>

<!-- Archive container -->
<div class="ambient-archive" data-layout={layout}>
  {#if layout === 'list'}
    <TrackList
      {tracks}
      {expandedTrackId}
      {imageErrors}
      onTrackClick={handleTrackClick}
      {playNow}
      onImageError={handleImageError}
      {isCurrentTrack}
      {isInSession}
    />
  {/if}
  
  {#if layout === 'grid'}
    <TrackGrid
      {tracks}
      {expandedTrackId}
      {imageErrors}
      onTrackClick={handleTrackClick}
      {playNow}
      onImageError={handleImageError}
      {isCurrentTrack}
      {isInSession}
    />
  {/if}
  
  {#if layout === 'carousel'}
    <TrackCarousel
      {title}
      {subtitle}
      {tracks}
      {expandedTrackId}
      {imageErrors}
      onTrackClick={handleTrackClick}
      {playNow}
      onImageError={handleImageError}
      {isCurrentTrack}
      {isInSession}
    />
  {/if}
</div>

<style>
  .ambient-archive {
    /* Base styles for the archive container */
  }
</style>