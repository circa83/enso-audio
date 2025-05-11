<script lang="ts">
    import type { Track } from '$lib/types/track';
    import SessionControls from '../SessionControls.svelte';
    import { session } from '$lib/player/store';
    
    export let track: Track;
    export let onPlayNow: () => void;
    
    $: isInSession = $session.some(t => t.id === track.id);
  </script>
  
  <!-- Wrapper for track controls  -->
  <div class="track-controls">
    <SessionControls 
      {track} 
      {onPlayNow}
      {isInSession}
    />
  </div>
  
  <style>
    .track-controls {
      /* Wrapper styling if needed in the future */
    }
  </style>