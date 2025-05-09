<script lang="ts">
    export let currentTime = 0;
    export let duration = 0;
    
    function formatTime(seconds: number): string {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  </script>
  
  <!-- Time display - exact same styling as was in Player.svelte -->
  <span class="font-mono text-xs text-enso-text-secondary">
    {formatTime(currentTime)} / {formatTime(duration)}
  </span>