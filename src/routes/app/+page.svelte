<script lang="ts">
  import Player from '$lib/player/Player.svelte';
  import AmbientArchive from '$lib/components/AmbientArchive.svelte';
  import SessionTracks from '$lib/components/SessionTracks.svelte';
  import { musicLibrary } from '$lib/data/tracks';
  import { current, session } from '$lib/player/store';
  import { onMount } from 'svelte';
  
  // Initialize with first track
  onMount(() => {
    if (!$current && musicLibrary.length > 0) {
      const firstTrack = musicLibrary[0];
      console.log('app/+page.svelte - Setting initial track:', firstTrack);
      current.set(firstTrack);
    }
  });
</script>

<div class="min-h-screen bg-enso-bg-primary">
  <div class="max-w-xl mx-auto px-4 py-8">
    <header class="mb-8 text-center flex flex-col items-center">
      <img 
        src="/logo/bkcp_white.png" 
        alt="Ensō Audio" 
        class="h-16 mx-auto mb-4"
      />
      
      <!-- Navigation back to landing page -->
      <a 
        href="/" 
        class="text-xs uppercase tracking-wider text-enso-text-secondary 
              hover:text-enso-text-primary transition-colors px-4 py-2
              border border-enso-border mb-4"
      >
        Back to Home
      </a>
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
    
    <!-- Session Tracks (always displayed as list) -->
    <SessionTracks />
    
    <!-- Ambient Archive -->
    <div class="mb-8 text-center">
      <h2 class="mb-4 text-lg font-thin tracking-wider uppercase">Ambient Archive</h2>
      <AmbientArchive tracks={musicLibrary} />
    </div>
  </div>
</div>