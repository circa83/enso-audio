<script lang="ts">
    import type { Track } from '$lib/types/track';
    import SessionControls from '../SessionControls.svelte';
    
    export let track: Track;
    export let onPlayNow: () => void;
  </script>
  
  <!-- Wrapper for track controls  -->
  <div class="track-controls">
    <SessionControls 
      {track} 
      {onPlayNow}
    />
  </div>
  
  <style>
    .track-controls {
      /* Wrapper styling if needed in the future */
    }
  </style>