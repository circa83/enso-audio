<script lang="ts">
    import type { Track } from '$lib/types/track';
    import GridTrackCard from './GridTrackCard.svelte';
    
    export let tracks: Track[] = [];
    export let expandedTrackId: string | null = null;
    export let imageErrors: Record<string, boolean> = {};
    export let onTrackClick: (track: Track) => void;
    export let playNow: (track: Track) => void;
    export let onImageError: (trackId: string) => void;
    export let isCurrentTrack: (trackId: string) => boolean;
    export let isInSession: (trackId: string) => boolean;
  </script>
  
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
    {#each tracks as track}
      <GridTrackCard
        {track}
        isPlaying={isCurrentTrack(track.id)}
        isSession={isInSession(track.id)}
        isExpanded={expandedTrackId === track.id}
        imageError={imageErrors[track.id] || false}
        onToggle={() => onTrackClick(track)}
        onPlayNow={() => playNow(track)}
        onImageError={() => onImageError(track.id)}
      />
    {/each}
  </div>