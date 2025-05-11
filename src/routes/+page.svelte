<script lang="ts">
  import Player from '$lib/player/Player.svelte';
  import AmbientArchive from '$lib/components/AmbientArchive.svelte';
  import SessionTracks from '$lib/components/SessionTracks.svelte';
  import CrossfadeController from '$lib/player/CrossfadeController.svelte';
  import { musicLibrary } from '$lib/data/tracks';
  import { current, session } from '$lib/player/store';
  import { onMount } from 'svelte';
  
  // Initialize with first track
  onMount(() => {
    if (!$current && musicLibrary.length > 0) {
      const firstTrack = musicLibrary[0];
      console.log('+page.svelte - Setting initial track:', firstTrack);
      current.set(firstTrack);
    }
  });
</script>

<div class="min-h-screen bg-enso-bg-primary">
  <div class="max-w-xl mx-auto px-4 py-8">
    <header class="mb-8 text-center">
      <!-- <h1 class="text-2xl sm:text-3xl font-thin tracking-[6px] mb-1">ENSŌ AUDIO</h1> -->
      <img 
      src="./logo/bkcp_white.png" 
      alt="Ensō Audio" 
      class="h-16 mx-auto mb-1"
    />
      <!-- <p class="text-enso-text-secondary uppercase tracking-[3px] text-xs">Ambient Archive</p> -->
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
    
    <!-- Session Controls -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-4">
        <CrossfadeController />
      </div>
    </div>
    
    <!-- Session Tracks (always displayed as list) -->
    <SessionTracks />
    
    <!-- Ambient Archive -->
    <div class="mb-8 text-center">
      <h2 class="mb-4 text-lg font-thin tracking-wider uppercase">Ambient Archive</h2>
      <AmbientArchive tracks={musicLibrary} />
    </div>
  </div>
</div>