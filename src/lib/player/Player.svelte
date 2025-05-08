<script lang="ts">
    import WaveSurfer from 'wavesurfer.js';
    import { onMount, onDestroy } from 'svelte';
    import { current, isPlaying, time, duration } from './store';
  
    export let src: string;     // required
    export let title = '';      // optional label
  
    let container: HTMLDivElement;
    let wavesurfer: WaveSurfer | null = null;
  
    /* ───── helpers ───── */
    function toggle() {
      if (!wavesurfer) return;
      wavesurfer.isPlaying() ? wavesurfer.pause() : wavesurfer.play();
    }
  
    /* ───── lifecycle ───── */
    onMount(() => {
      wavesurfer = WaveSurfer.create({
        container,
        url: src,
        waveColor: '#333',
        progressColor: '#fff',
        height: 80,
        backend: 'WebAudio', // default
      });
  
      wavesurfer.on('ready', () => {
        duration.set(wavesurfer!.getDuration());
        current.set({ url: src, title });
      });
  
      wavesurfer.on('audioprocess', () => {
        time.set(wavesurfer!.getCurrentTime());
      });
  
      wavesurfer.on('play', () => isPlaying.set(true));
      wavesurfer.on('pause', () => isPlaying.set(false));
  
      return () => {
        wavesurfer?.destroy();
      };
    });
  
    onDestroy(() => wavesurfer?.destroy());
  </script>
  
  <div class="space-y-2">
    <div bind:this={container} class="w-full"></div>
  
    <div class="flex items-center gap-4">
      <button class="btn" on:click={toggle}>
        {$isPlaying ? '❚❚' : '▶︎'}
      </button>
  
      <span class="text-sm truncate">{title}</span>
      <span class="ml-auto text-xs">
        {Math.floor($time)} / {Math.floor($duration)} s
      </span>
    </div>
  </div>
  