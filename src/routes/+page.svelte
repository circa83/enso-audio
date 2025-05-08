<script lang="ts">
  import Player from '$lib/player/Player.svelte';
  import TrackList from '$lib/components/TrackList.svelte';
  import CrossfadeController from '$lib/player/CrossfadeController.svelte';
  import { musicLibrary } from '$lib/data/tracks';
  import { current, queue } from '$lib/player/store';
  import { onMount } from 'svelte';
  
  // Initialize with first track
  onMount(() => {
    if (!$current && musicLibrary.length > 0) {
      const firstTrack = musicLibrary[0];
      current.set(firstTrack);
    }
  });
</script>

<div class="min-h-screen bg-enso-bg-primary">
  <div class="max-w-xl mx-auto px-4 py-8">
    <header class="mb-8 text-center">
      <h1 class="text-2xl sm:text-3xl font-thin tracking-[6px] mb-1">ENSŌ AUDIO</h1>
      <p class="text-enso-text-secondary uppercase tracking-[3px] text-xs">Ambient Archive</p>
    </header>
    
    <!-- Current Player -->
    {#if $current}
      <div class="bg-enso-bg-primary mb-8">
        <Player 
          src={$current.src} 
          title={$current.title} 
          artwork={$current.artwork} 
        />
      </div>
    {/if}
    
    <!-- Queue Controls -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-thin tracking-wider uppercase">Library</h2>
      <div class="flex items-center gap-4">
        <CrossfadeController />
        {#if $queue.length > 0}
          <span class="text-xs text-enso-text-secondary uppercase tracking-wider">
            {$queue.length} in queue
          </span>
        {/if}
      </div>
    </div>
    
    <!-- Track List -->
    <TrackList tracks={musicLibrary} />
    
    <!-- Queue Section (if items are queued) -->
    {#if $queue.length > 0}
      <div class="mt-8">
        <h2 class="text-lg font-thin tracking-wider uppercase mb-4">Queue</h2>
        <TrackList tracks={$queue} showQueueControls={true} />
      </div>
    {/if}
  </div>
</div>