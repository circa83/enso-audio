<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    
    export let enabled = false;
    export let duration = 5;
    
    const dispatch = createEventDispatcher<{
      toggle: boolean;
      durationChange: number;
    }>();
    
    function toggleCrossfade() {
      enabled = !enabled;
      dispatch('toggle', enabled);
      console.log('CrossfadeControls.svelte - Crossfade toggled:', enabled);
    }
    
    function updateDuration(event: Event) {
      const target = event.target as HTMLInputElement;
      duration = parseInt(target.value);
      dispatch('durationChange', duration);
      console.log('CrossfadeControls.svelte - Duration changed:', duration);
    }
  </script>
  
  <div class="space-y-4">
    <!-- Enable/Disable Toggle -->
    <div class="flex items-center justify-between">
      <span class="text-xs uppercase tracking-wider text-enso-text-primary">
        Crossfade
      </span>
      <button
        class="w-12 h-6 border border-enso-border relative transition-all duration-200
               {enabled ? 'bg-enso-text-primary' : 'bg-transparent'}"
        on:click={toggleCrossfade}
        aria-label={enabled ? 'Disable crossfade' : 'Enable crossfade'}
      >
        <span 
          class="absolute top-0.5 left-0.5 w-5 h-5 bg-enso-bg-primary border border-enso-border
                 transition-transform duration-200
                 {enabled ? 'translate-x-6' : 'translate-x-0'}"
        ></span>
      </button>
    </div>
    
    <!-- Duration Slider -->
    {#if enabled}
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs uppercase tracking-wider text-enso-text-secondary">
            Duration
          </span>
          <span class="font-mono text-xs text-enso-text-secondary">
            {duration}s
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="10"
          value={duration}
          on:input={updateDuration}
          class="w-full h-1 bg-enso-border appearance-none cursor-pointer
                 [&::-webkit-slider-thumb]:appearance-none
                 [&::-webkit-slider-thumb]:w-3
                 [&::-webkit-slider-thumb]:h-3
                 [&::-webkit-slider-thumb]:bg-enso-text-primary
                 [&::-webkit-slider-thumb]:border
                 [&::-webkit-slider-thumb]:border-enso-border
                 [&::-moz-range-thumb]:w-3
                 [&::-moz-range-thumb]:h-3
                 [&::-moz-range-thumb]:bg-enso-text-primary
                 [&::-moz-range-thumb]:border
                 [&::-moz-range-thumb]:border-enso-border
                 [&::-moz-range-thumb]:rounded-none"
        />
      </div>
    {/if}
  </div>