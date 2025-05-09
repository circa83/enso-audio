<script lang="ts">
    import { audioEngine } from '$lib/player/services/AudioEngine';
    import { isPlaying } from '$lib/player/store';
    
    // Subscribe to AudioEngine stores
    const audioIsPlaying = audioEngine.isPlaying;
    const audioIsLoading = audioEngine.isLoading;
  
    async function toggle() {
      console.log('PlaybackControls.svelte - toggle() called');
      
      try {
        await audioEngine.resumeAudioContext();
        
        if ($audioIsPlaying) {
          console.log('PlaybackControls.svelte - pausing');
          audioEngine.pause();
        } else {
          console.log('PlaybackControls.svelte - playing');
          audioEngine.play();
        }
      } catch (err) {
        console.error('PlaybackControls.svelte - Error toggling playback:', err);
      }
    }
  </script>
  
  <!-- Play/Pause button -->
  <button 
    class="w-12 h-12 border border-enso-border rounded-full flex items-center justify-center 
           text-enso-text-primary bg-transparent transition-all duration-200 
           hover:bg-enso-bg-secondary cursor-pointer disabled:opacity-50"
    on:click={toggle}
    disabled={$audioIsLoading}
    aria-label={$isPlaying ? 'Pause' : 'Play'}
  >
    {#if $audioIsLoading}
      <!-- Loading spinner -->
      <div class="w-6 h-6 border-2 border-enso-text-secondary border-t-transparent rounded-full animate-spin"></div>
    {:else if $isPlaying}
      <!-- Pause icon -->
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" />
      </svg>
    {:else}
      <!-- Play icon -->
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z" />
      </svg>
    {/if}
  </button>