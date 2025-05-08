<script lang="ts">
  import { current, isPlaying, queue, addToQueue, clearQueue } from '$lib/player/store';
  import type { Track } from '$lib/types/track';
  
  export let track: Track;
  export let onPlayNow: () => void;
  
  function handleAddToQueue() {
    console.log('QueueControls.svelte - handleAddToQueue', track.title);
    addToQueue(track);
  }
  
  function handlePlayNow() {
    console.log('QueueControls.svelte - handlePlayNow', track.title);
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
  <button
    on:click={handleAddToQueue}
    class="flex-1 px-3 py-2 text-xs uppercase tracking-wider 
           border border-enso-border hover:bg-enso-bg-secondary 
           transition-colors"
  >
    Add to Queue
  </button>
</div>