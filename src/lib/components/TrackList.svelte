<script lang="ts">
  import { current, queue, addToQueue, removeFromQueue } from '$lib/player/store';
  import QueueControls from './QueueControls.svelte';
  import type { Track } from '$lib/types/track';
  
  export let tracks: Track[] = [];
  export let showQueueControls = false;
  
  let expandedTrackId: string | null = null;
  let imageErrors: Record<string, boolean> = {};
  
  function handleTrackClick(track: Track) {
    console.log('TrackList.svelte - handleTrackClick', track.title);
    if (expandedTrackId === track.id) {
      expandedTrackId = null;
    } else {
      expandedTrackId = track.id;
    }
  }
  
  function playNow(track: Track) {
    console.log('TrackList.svelte - playNow', track.title);
    current.set(track);
    expandedTrackId = null;
  }
  
  function handleImageError(trackId: string) {
    console.error(`Failed to load image for track ${trackId}`);
    imageErrors[trackId] = true;
  }
  
  function isInQueue(trackId: string): boolean {
    return $queue.some(t => t.id === trackId);
  }
  
  function isCurrentTrack(trackId: string): boolean {
    return $current?.id === trackId;
  }
</script>

<div class="space-y-1">
  {#each tracks as track}
    <div class="border border-enso-border {isCurrentTrack(track.id) ? 'border-enso-text-primary' : ''}">
      <button
        on:click={() => handleTrackClick(track)}
        class="w-full flex items-center gap-3 p-3
               hover:bg-enso-bg-secondary transition-colors text-left
               {isCurrentTrack(track.id) ? 'bg-enso-bg-secondary' : ''}"
      >
        <!-- Album artwork thumbnail -->
        <div class="w-12 h-12 flex-shrink-0 bg-enso-bg-secondary">
          {#if !imageErrors[track.id]}
            <img 
              src={track.artwork} 
              alt={track.title}
              class="w-full h-full object-cover"
              on:error={() => handleImageError(track.id)}
            />
          {:else}
            <div class="w-full h-full flex items-center justify-center text-enso-text-secondary text-xs">
              No Image
            </div>
          {/if}
        </div>
        
        <!-- Track info -->
        <div class="flex-1 min-w-0">
          <p class="text-sm font-thin tracking-wider truncate">
            {track.title}
          </p>
          {#if track.artist}
            <p class="text-xs text-enso-text-secondary truncate">
              {track.artist}
            </p>
          {/if}
        </div>
        
        <!-- Status indicators -->
        <div class="flex-shrink-0 flex items-center gap-2 text-xs">
          {#if isCurrentTrack(track.id)}
            <span class="text-enso-text-primary uppercase tracking-wider">Playing</span>
          {/if}
          {#if isInQueue(track.id)}
            <span class="text-enso-text-secondary uppercase tracking-wider">Queued</span>
          {/if}
        </div>
      </button>
      
      <!-- Expanded controls -->
      {#if expandedTrackId === track.id && !isCurrentTrack(track.id)}
        <div class="p-3 bg-enso-bg-secondary border-t border-enso-border">
          <QueueControls 
            {track} 
            onPlayNow={() => playNow(track)}
          />
        </div>
      {/if}
    </div>
  {/each}
</div>