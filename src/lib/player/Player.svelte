<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { audioEngine } from '$lib/player/services/AudioEngine';
  import { current, isPlaying, time, duration } from './store';
  import type { Track } from '$lib/types/track';

  export let src: string;
  export let title = '';
  export let artwork = '';

  let container: HTMLDivElement;
  let showArtworkError = false;
  
  // Subscribe to AudioEngine stores and sync with legacy stores
  const audioIsPlaying = audioEngine.isPlaying;
  const audioCurrentTime = audioEngine.currentTime;
  const audioDuration = audioEngine.duration;
  
  // Sync AudioEngine values with legacy stores for backward compatibility
  $: isPlaying.set($audioIsPlaying);
  $: time.set($audioCurrentTime);
  $: duration.set($audioDuration);

  function toggle() {
    console.log('Player.svelte - toggle() called');
    
    // This is a user interaction, so it's a good time to ensure audio is unlocked
    audioEngine.resumeAudioContext().then(() => {
      if ($audioIsPlaying) {
        audioEngine.pause();
      } else {
        audioEngine.play();
      }
    }).catch(err => {
      console.error('Player.svelte - Error resuming audio context:', err);
      // Still try to toggle playback even if resuming fails
      if ($audioIsPlaying) {
        audioEngine.pause();
      } else {
        audioEngine.play();
      }
    });
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function handleArtworkError(e: Event) {
    console.error(`Failed to load artwork in Player:`, artwork);
    showArtworkError = true;
  }

  onMount(async () => {
    console.log('Player.svelte - onMount called, creating WaveSurfer instance');
    console.log('Player.svelte - src:', src);
    
    // Initialize AudioEngine
    audioEngine.initialize(container);
    
    // Create track for store (matching original)
    const track: Track = { 
      id: Date.now().toString(),
      src, 
      title, 
      artwork,
      artist: undefined
    };
    current.set(track);
    
    // Load in AudioEngine - handle both relative and absolute paths
    if (src) {
      try {
        // If src doesn't start with '/', assume it's in the audio directory
        const audioUrl = src.startsWith('/') ? src : `/${src}`;
        await audioEngine.load({ url: audioUrl, title, artwork });
      } catch (error) {
        console.error('Player.svelte - Error loading track:', error);
      }
    }
  });

  onDestroy(() => {
    console.log('Player.svelte - onDestroy called');
    audioEngine.destroy();
  });

  // Handle track changes
  $: if (src && container) {
    audioEngine.load({ url: src, title, artwork }).catch(err => {
      console.error('Player.svelte - Error reloading track:', err);
    });
  }
</script>

<div class="w-full space-y-4">
  <!-- Album artwork -->
  {#if artwork && !showArtworkError}
    <div class="flex justify-center w-full">
      <div class="w-1/2 aspect-square bg-enso-bg-secondary overflow-hidden">
        <img 
          src={artwork} 
          alt="{title} artwork"
          class="w-full h-full object-cover"
          on:error={handleArtworkError}
        />
      </div>
    </div>
  {:else}
    <div class="flex justify-center w-full">
      <div class="w-full aspect-square bg-enso-bg-secondary border border-enso-border flex items-center justify-center">
        <span class="text-enso-text-secondary uppercase tracking-wider text-sm">No Artwork</span>
      </div>
    </div>
  {/if}  
  
  <!-- Waveform container -->
  <div 
    bind:this={container} 
    class="w-full bg-enso-bg-primary"
  ></div>

  <!-- Controls -->
  <div class="flex items-center gap-6">
    <!-- Play/Pause button -->
    <button 
      class="w-12 h-12 border border-enso-border rounded-full flex items-center justify-center text-enso-text-primary bg-transparent transition-all duration-200 hover:bg-enso-bg-secondary cursor-pointer"
      on:click={toggle}
      aria-label={$isPlaying ? 'Pause' : 'Play'}
    >
      {#if $isPlaying}
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

    <!-- Track title -->
    <span class="flex-1 text-sm uppercase tracking-wider font-thin text-enso-text-primary truncate">
      {title}
    </span>

    <!-- Time display -->
    <span class="font-mono text-xs text-enso-text-secondary">
      {formatTime($time)} / {formatTime($duration)}
    </span>
  </div>
</div>