<script lang="ts">
    import { crossfadeDuration } from './store';
    
    let showSettings = false;
  </script>
  
  <div class="relative">
    <button
      on:click={() => showSettings = !showSettings}
      class="text-xs uppercase tracking-wider text-enso-text-secondary 
             hover:text-enso-text-primary transition-colors p-2"
    >
      Crossfade: {$crossfadeDuration}s
    </button>
    
    {#if showSettings}
      <div class="absolute top-full right-0 mt-2 bg-enso-bg-secondary border border-enso-border p-4 z-10">
        <label class="block text-xs uppercase tracking-wider mb-2">
          Crossfade Duration
        </label>
        <input
          type="range"
          bind:value={$crossfadeDuration}
          min="0"
          max="10"
          step="1"
          class="w-32 accent-enso-text-primary"
        />
        <div class="text-xs text-center mt-1">{$crossfadeDuration} seconds</div>
      </div>
    {/if}
  </div>