<script lang="ts">
    import WaveSurfer from 'wavesurfer.js';
    import { onMount, onDestroy } from 'svelte';
    import { current, isPlaying, time, duration } from './store';
  
    export let src: string;
    export let title = '';
  
    let container: HTMLDivElement;
    let wavesurfer: WaveSurfer | null = null;
  
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
  
    onMount(() => {
      console.log('Player.svelte - onMount called, creating WaveSurfer instance');
      
      wavesurfer = WaveSurfer.create({
        container,
        url: src,
        waveColor: '#333333',
        progressColor: '#ffffff',
        cursorColor: '#ffffff',
        cursorWidth: 1,
        height: 80,
        normalize: true,
        backend: 'WebAudio',
        interact: true,
        barWidth: 1,
        barGap: 1,
        // Removed 'responsive' as it's not available in the current version
      });
  
      wavesurfer.on('ready', () => {
        console.log('Player.svelte - WaveSurfer ready event');
        duration.set(wavesurfer!.getDuration());
        current.set({ url: src, title });
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
    <!-- Waveform container -->
    <div 
      bind:this={container} 
      class="w-full border border-enso-border bg-enso-bg-primary"
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