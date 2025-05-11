<!-- src/lib/components/archive/TrackControls.svelte -->
<script lang="ts">
  import type { Track } from '$lib/types/track';
  import SessionControls from '../SessionControls.svelte';
  import { session } from '$lib/player/store';
  
  export let track: Track;
  export let onPlayNow: () => void;
  export let sessionItemId: string | undefined = undefined;
  
  // Check if track is in session (considering it might be a SessionItem)
  $: isInSession = sessionItemId ? true : $session.some(item => item.track.id === track.id);
</script>

<!-- Wrapper for track controls with responsive text sizing -->
<div class="track-controls sm:text-[5px]">
  <SessionControls 
    {track} 
    {onPlayNow}
    {isInSession}
    {sessionItemId}
  />
</div>

<style>
  .track-controls {
    /* The Tailwind classes above handle the responsive text sizing */
  }
</style>