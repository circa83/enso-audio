<script lang="ts">
    import type { Track } from '$lib/types/track';
    import { addToSession } from '$lib/player/store';
    import AlbumArt from '$lib/components/AlbumArt.svelte';
    
    export let track: Track;
    export let isPlaying: boolean = false;
    export let isSession: boolean = false;
    export let isExpanded: boolean = false;
    export let imageError: boolean = false;  // Kept for backward compatibility
    export let onToggle: () => void;
    export let onPlayNow: () => void;
    export let onImageError: () => void;      // Kept for backward compatibility
    
    function handleAddToSession() {
      console.log('GridTrackCard.svelte - handleAddToSession', track.title);
      addToSession(track);
      onToggle(); // Close the expanded view
    }
    
    function handleToggle() {
      console.log('GridTrackCard.svelte - handleToggle', track.title);
      onToggle();
    }
    
    function handlePlayNow() {
      console.log('GridTrackCard.svelte - handlePlayNow', track.title);
      onPlayNow();
    }
  </script>
  
  <div class="grid-track-card">
    <button
      on:click={handleToggle}
      class="w-full group relative
             {isPlaying ? 'border-enso-text-primary' : 'border-enso-border'}"
    >
      <!-- Album artwork -->
      <div class="aspect-square w-full bg-enso-bg-secondary border border-enso-border overflow-hidden">
        <div class="w-full h-full transition-transform duration-300 group-hover:scale-105">
          <AlbumArt src={track.artwork} alt={track.title} />
        </div>
        
        <!-- Playing/Session overlay indicators -->
        {#if isPlaying || isSession}
          <div class="absolute top-0 left-0 right-0 flex justify-between p-2">
            {#if isPlaying}
              <span class="text-xs uppercase tracking-wider bg-enso-bg-primary
                           border border-enso-text-primary text-enso-text-primary px-2 py-1">
                Playing
              </span>
            {/if}
            {#if isSession}
              <span class="text-xs uppercase tracking-wider bg-enso-bg-primary
                           border border-enso-border text-enso-text-secondary px-2 py-1
                           {isPlaying ? '' : 'ml-auto'}">
                Session
              </span>
            {/if}
          </div>
        {/if}
      </div>
  
      <!-- Track info -->
      <div class="mt-2 text-left">
        <p class="text-sm font-thin tracking-wider truncate">
          {track.title}
        </p>
        <!-- {#if track.artist}
          <p class="text-xs text-enso-text-secondary truncate">
            {track.artist}
          </p>
        {/if} -->
      </div>
    </button>
    
    <!-- Expanded controls overlay -->
    {#if isExpanded && !isPlaying}
      <div class="absolute inset-0 flex items-center justify-center bg-enso-bg-primary 
                  bg-opacity-95 border border-enso-border z-10">
        <div class="w-full p-4">
          <button
            on:click={handlePlayNow}
            class="w-full px-3 py-2 mb-2 text-xs uppercase tracking-wider 
                   border border-enso-border hover:bg-enso-bg-secondary 
                   transition-colors"
          >
            Play Now
          </button>
          <button
            on:click={handleAddToSession}
            class="w-full px-2 py-2 text-[9px] sm:text-xs text-center uppercase tracking-wider 
                   border border-enso-border hover:bg-enso-bg-secondary 
                   transition-colors"
          >
            Add to Session
          </button>
        </div>
      </div>
    {/if}
  </div>
  
  <style>
    .grid-track-card {
      position: relative;
    }
  </style>