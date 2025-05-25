<!-- src/lib/player/Player.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { webAudioEngine } from '$lib/player/services/WebAudioEngine';
  import { sessionManager } from '$lib/player/services/SessionManager';
  import { current, isPlaying, time, duration, currentSessionItemId, session } from './store';
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
  
  // Subscribe to WebAudioEngine stores and sync with legacy stores
  const audioIsPlaying = webAudioEngine.isPlaying;
  const audioCurrentTime = webAudioEngine.currentTime;
  const audioDuration = webAudioEngine.duration;
  const audioError = webAudioEngine.error;
  
  // Sync WebAudioEngine values with legacy stores
  $: isPlaying.set($audioIsPlaying);
  $: time.set($audioCurrentTime);
  $: duration.set($audioDuration);

  // Look for session item ID when current track changes - REFINED VERSION
  $: if ($current) {
    // Get the current session item if one is set
    const currentSessionItem = $currentSessionItemId 
      ? $session.find(item => item.id === $currentSessionItemId) 
      : null;
    
    // Case 1: We have a current session item
    if (currentSessionItem) {
      // Check if it still matches the current track
      if (currentSessionItem.track.id !== $current.id) {
        // Track has changed, clear session item ID
        console.log('Player.svelte - Current session item no longer matches current track');
        currentSessionItemId.set(null);
        
        // Don't automatically find a new session item - let the explicit "Play Now" handle that
      }
    }
    // Case 2: No current session item, so we might need to find one (only if not from explicit Play Now)
    else if (!$currentSessionItemId) {
      // Find any matching session item for the current track
      const matchingSessionItem = $session.find(item => item.track.id === $current.id);
      if (matchingSessionItem) {
        console.log('Player.svelte - Found matching session item for current track:', matchingSessionItem.id);
        currentSessionItemId.set(matchingSessionItem.id);
      }
    }
  }

  function handleTrackFinished() {
    console.log('Player.svelte - handleTrackFinished');
    sessionManager.playNext();
  }

  onMount(async () => {
    webAudioEngine.initialize(container);
    webAudioEngine.onFinish(handleTrackFinished);
    
    console.log('Player.svelte - Current track on mount:', $current);
    
    // Load track
    if (src) {
      try {
        const audioUrl = src.startsWith('/') ? src : `/${src}`;
        await webAudioEngine.load({ url: audioUrl, title, artwork });
      } catch (error) {
        console.error('Player - Error loading track:', error);
      }
    }
  });

  onDestroy(() => {
    webAudioEngine.destroy();
  });

  // Handle track changes
  $: if (src && container) {
    // Check if we should auto-play based on:
    // 1. Session manager's auto-play flag (for session transitions)
    // 2. If playback is currently active when "Play Now" is clicked
    const shouldAutoPlay = sessionManager.shouldAutoPlay() || get(isPlaying);
    
    console.log('Player.svelte - Loading track, shouldAutoPlay:', shouldAutoPlay);
    webAudioEngine.load({ url: src, title, artwork }, shouldAutoPlay)
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
  
  <!-- Waveform display - KEEP EXISTING COMPONENT -->
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