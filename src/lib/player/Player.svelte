<!-- src/lib/player/Player.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { audioEngine } from '$lib/player/services/AudioEngine';
  import { sessionManager } from '$lib/player/services/SessionManager';
  import { current, isPlaying, time, duration } from './store';
  import WaveformDisplay from '$lib/components/WaveformDisplay.svelte';
  import PlaybackControls from '$lib/components/PlaybackControls.svelte';
  import TrackInfo from '$lib/components/TrackInfo.svelte';
  import TimeDisplay from '$lib/components/TimeDisplay.svelte';
  import AlbumArt from '$lib/components/AlbumArt.svelte';
  import type { Track } from '$lib/types/track';

  export let src: string;
  export let title = '';
  export let artwork = '';

  let container: HTMLDivElement;
  
  // Subscribe to AudioEngine stores and sync with legacy stores
  const audioIsPlaying = audioEngine.isPlaying;
  const audioCurrentTime = audioEngine.currentTime;
  const audioDuration = audioEngine.duration;
  const audioError = audioEngine.error;
  
  // Sync AudioEngine values with legacy stores
  $: isPlaying.set($audioIsPlaying);
  $: time.set($audioCurrentTime);
  $: duration.set($audioDuration);

  function handleTrackFinished() {
    console.log('Player.svelte - handleTrackFinished');
    sessionManager.playNext();
  }

  onMount(async () => {
    audioEngine.initialize(container);
    audioEngine.onFinish(handleTrackFinished);
    
    // DON'T create a new track - the current track should already be set
    // by the parent component (page.svelte) or session manager
    console.log('Player.svelte - Current track on mount:', $current);
    
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
    // Check if we should auto-play based on:
    // 1. Session manager's auto-play flag (for session transitions)
    // 2. If playback is currently active when "Play Now" is clicked
    const shouldAutoPlay = sessionManager.shouldAutoPlay() || get(isPlaying);
    
    console.log('Player.svelte - Loading track, shouldAutoPlay:', shouldAutoPlay);
    audioEngine.load({ url: src, title, artwork }, shouldAutoPlay)
      .catch(console.error);
  }
</script>

<div class="w-full space-y-4">
  <!-- Album artwork -->
  <div class="flex justify-center w-full">
    <div class="w-2/3 aspect-square">
      <AlbumArt src={artwork} alt="{title} artwork" />
    </div>
  </div>
  
  <!-- Waveform display -->
  <WaveformDisplay bind:container />

  <!-- Controls -->
  <div class="flex items-center gap-6">
    <!-- Playback Controls -->
    <PlaybackControls />

    <!-- Track Info -->
    <TrackInfo {title} />

    <!-- Time display -->
    <TimeDisplay currentTime={$time} duration={$duration} />
  </div>

  <!-- Error display -->
  {#if $audioError}
    <div class="text-xs text-red-500 text-center">
      {$audioError}
    </div>
  {/if}
</div>