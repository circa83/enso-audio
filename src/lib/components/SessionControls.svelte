<!-- src/lib/components/SessionControls.svelte -->
<script lang="ts">
  import { current, isPlaying, session, addToSession, removeFromSession, clearSession } from '$lib/player/store';
  import type { Track } from '$lib/types/track';
  
  export let track: Track;
  export let onPlayNow: () => void;
  export let isInSession: boolean = false;
  export let sessionItemId: string | undefined = undefined; // NEW PROP
  
  function handleAddToSession() {
    console.log('SessionControls.svelte - handleAddToSession', track.title);
    addToSession(track);
  }
  
  function handleRemoveFromSession() {
    console.log('SessionControls.svelte - handleRemoveFromSession', track.title);
    if (sessionItemId) {
      // Remove specific session item
      removeFromSession(sessionItemId);
    } else {
      // This should not happen in session context, but keeping as fallback
      console.warn('SessionControls.svelte - No sessionItemId provided, falling back to track.id');
      removeFromSession(track.id);
    }
  }
  
  function handlePlayNow() {
    console.log('SessionControls.svelte - handlePlayNow', track.title);
    onPlayNow();
  }
</script>

<div class="flex gap-2">
  <button
    on:click={handlePlayNow}
    class="flex-1 px-3 py-2 text-xs uppercase tracking-wider 
           border border-enso-border hover:bg-enso-bg-secondary 
           transition-colors"
  >
    Play Now
  </button>
  {#if isInSession}
    <button
      on:click={handleRemoveFromSession}
      class="flex-1 px-3 py-2 text-xs uppercase tracking-wider 
             border border-enso-border hover:bg-enso-bg-secondary 
             transition-colors"
    >
      Remove from Session
    </button>
  {:else}
    <button
      on:click={handleAddToSession}
      class="flex-1 px-3 py-2 text-xs uppercase tracking-wider 
             border border-enso-border hover:bg-enso-bg-secondary 
             transition-colors"
    >
      Add to Session
    </button>
  {/if}
</div>