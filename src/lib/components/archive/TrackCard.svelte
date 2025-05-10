<script lang="ts">
  import type { Track } from '$lib/types/track';
  import TrackControls from './TrackControls.svelte';
  
  export let track: Track;
  export let isPlaying: boolean = false;
  export let isSession: boolean = false;
  export let isExpanded: boolean = false;
  export let imageError: boolean = false;
  export let onToggle: () => void;
  export let onPlayNow: () => void;
  export let onImageError: () => void;
</script>

<div class="border border-enso-border {isPlaying ? 'border-enso-text-primary' : ''}">
  <button
    on:click={onToggle}
    class="w-full flex items-center gap-3 p-3
           hover:bg-enso-bg-secondary transition-colors text-left
           {isPlaying ? 'bg-enso-bg-secondary' : ''}"
  >
    <!-- Album artwork thumbnail -->
    <div class="w-12 h-12 flex-shrink-0 bg-enso-bg-secondary">
      {#if !imageError}
        <img 
          src={track.artwork} 
          alt={track.title}
          class="w-full h-full object-cover"
          on:error={onImageError}
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
      {#if isPlaying}
        <span class="text-enso-text-primary uppercase tracking-wider">Playing</span>
      {/if}
      {#if isSession}
        <span class="text-enso-text-secondary uppercase tracking-wider">Session</span>
      {/if}
    </div>
  </button>
  
  <!-- Expanded controls -->
  {#if isExpanded && !isPlaying}
    <div class="p-3 bg-enso-bg-secondary border-t border-enso-border">
      <TrackControls 
        {track} 
        {onPlayNow}
      />
    </div>
  {/if}
</div>