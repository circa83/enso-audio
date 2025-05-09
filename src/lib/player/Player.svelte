<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { audioEngine } from '$lib/player/services/AudioEngine';
  import { current, isPlaying, time, duration } from './store';
  import WaveformDisplay from '$lib/components/WaveformDisplay.svelte';
  import PlaybackControls from '$lib/components/PlaybackControls.svelte';
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
  const audioError = audioEngine.error;
  
  // Sync AudioEngine values with legacy stores
  $: isPlaying.set($audioIsPlaying);
  $: time.set($audioCurrentTime);
  $: duration.set($audioDuration);

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function handleArtworkError() {
    showArtworkError = true;
  }

  onMount(async () => {
    audioEngine.initialize(container);
    
    // Create track for store
    const track: Track = { 
      id: Date.now().toString(),
      src, 
      title, 
      artwork,
      artist: undefined
    };
    current.set(track);
    
    // Load track
    if (src) {
      try {
        const audioUrl = src.startsWith('/') ? src : `/${src}`;
        await audioEngine.load({ url: audioUrl, title, artwork });
      } catch (error) {
        console.error('Player - Error loading track:', error);
      }
    }
  });

  onDestroy(() => {
    audioEngine.destroy();
  });

  // Handle track changes
  $: if (src && container) {
    audioEngine.load({ url: src, title, artwork }).catch(console.error);
  }
</script>

<div class="w-full space-y-4">
  <!-- Album artwork -->
  <div class="flex justify-center w-full">
    {#if artwork && !showArtworkError}
      <div class="w-1/2 aspect-square bg-enso-bg-secondary overflow-hidden">
        <img 
          src={artwork} 
          alt="{title} artwork"
          class="w-full h-full object-cover"
          on:error={handleArtworkError}
        />
      </div>
    {:else}
      <div class="w-full aspect-square bg-enso-bg-secondary border border-enso-border flex items-center justify-center">
        <span class="text-enso-text-secondary uppercase tracking-wider text-sm">No Artwork</span>
      </div>
    {/if}
  </div>
  
  <!-- Waveform display -->
  <WaveformDisplay bind:container />

  <!-- Controls -->
  <div class="flex items-center gap-6">
    <!-- Playback Controls -->
    <PlaybackControls />

    <!-- Track title -->
    <span class="flex-1 text-sm uppercase tracking-wider font-thin text-enso-text-primary truncate">
      {title}
    </span>

    <!-- Time display -->
    <span class="font-mono text-xs text-enso-text-secondary">
      {formatTime($time)} / {formatTime($duration)}
    </span>
  </div>

  <!-- Error display -->
  {#if $audioError}
    <div class="text-xs text-red-500 text-center">
      {$audioError}
    </div>
  {/if}
</div>