<script lang="ts">
  import Player from '$lib/player/Player.svelte';
  import AmbientArchive from '$lib/components/AmbientArchive.svelte';
  import SessionTracks from '$lib/components/SessionTracks.svelte';
  import CrossfadeController from '$lib/player/CrossfadeController.svelte';
  import { musicLibrary } from '$lib/data/tracks';
  import { current, session } from '$lib/player/store';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  // First-time visitor detection
  let hasVisitedBefore = false;
  
  onMount(() => {
    if (browser) {
      // Check if user has visited before using localStorage
      hasVisitedBefore = localStorage.getItem('enso_visited') === 'true';
      
      // If first visit, redirect to landing page
      if (!hasVisitedBefore && window.location.pathname === '/') {
        // Set visited flag first to prevent redirect loops
        localStorage.setItem('enso_visited', 'true');
        // Redirect to landing page
        window.location.href = '/landing';
        return;
      }
      
      // Otherwise mark as visited
      localStorage.setItem('enso_visited', 'true');
      
      // Initialize with first track
      if (!$current && musicLibrary.length > 0) {
        const firstTrack = musicLibrary[0];
        console.log('+page.svelte - Setting initial track:', firstTrack);
        current.set(firstTrack);
      }
    }
  });
</script>

<div class="min-h-screen bg-enso-bg-primary">
  <div class="max-w-xl mx-auto px-4 py-8">
    <header class="mb-8 text-center">
      <img 
        src="./logo/bkcp_white.png" 
        alt="Ensō Audio" 
        class="h-16 mx-auto mb-1"
      />
      <!-- Link back to landing page -->
      <a 
        href="/landing"
        class="text-xs uppercase tracking-[2px] text-enso-text-secondary hover:text-enso-text-primary transition-colors"
      >
        About the artist
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