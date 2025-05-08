<script lang="ts">
  import WaveSurfer from 'wavesurfer.js';
  import { onMount, onDestroy } from 'svelte';
  import { current, isPlaying, time, duration } from './store';

  export let src: string;
  export let title = '';
  export let artwork = '';

  let container: HTMLDivElement;
  let wavesurfer: WaveSurfer | null = null;
  let showArtworkError = false;

  function toggle() {
    console.log('Player.svelte - toggle() called');
    if (!wavesurfer) return;
    wavesurfer.isPlaying() ? wavesurfer.pause() : wavesurfer.play();
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

  onMount(() => {
    console.log('Player.svelte - onMount called, creating WaveSurfer instance');
    
    wavesurfer = WaveSurfer.create({
      container,
      url: src,
      waveColor: '#333333',
      progressColor: '#ffffff',
      cursorColor: '#ffffff',
      cursorWidth: 1,
      height: 48,
      normalize: true,
      backend: 'WebAudio',
      interact: true,
      barWidth: 1,
      barGap: 1,
    });

    wavesurfer.on('ready', () => {
      console.log('Player.svelte - WaveSurfer ready event');
      duration.set(wavesurfer!.getDuration());
      current.set({ 
        id: Date.now().toString(),
        src: src, 
        title, 
        artwork,
        artist: undefined
      });
    });

    wavesurfer.on('audioprocess', () => {
      time.set(wavesurfer!.getCurrentTime());
    });

    wavesurfer.on('play', () => {
      console.log('Player.svelte - WaveSurfer play event');
      isPlaying.set(true);
    });
    
    wavesurfer.on('pause', () => {
      console.log('Player.svelte - WaveSurfer pause event');
      isPlaying.set(false);
    });

    wavesurfer.on('error', (error) => {
      console.error('Player.svelte - WaveSurfer error:', error);
    });

    // Handle window resize manually since 'responsive' is no longer available
    const handleResize = () => {
      if (wavesurfer) {
        console.log('Player.svelte - handleResize() called');
        wavesurfer.setOptions({ fillParent: true });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      wavesurfer?.destroy();
    };
  });

  onDestroy(() => {
    console.log('Player.svelte - onDestroy called');
    wavesurfer?.destroy();
  });
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