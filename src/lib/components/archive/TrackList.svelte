<script lang="ts">
    import type { Track } from '$lib/types/track';
    import ListTrackCard from './ListTrackCard.svelte';
    
    export let tracks: Track[] = [];
    export let expandedTrackId: string | null = null;
    export let imageErrors: Record<string, boolean> = {};
    export let onTrackClick: (track: Track) => void;
    export let playNow: (track: Track) => void;
    export let onImageError: (trackId: string) => void;
    export let isCurrentTrack: (trackId: string) => boolean;
    export let isInSession: (trackId: string) => boolean;
  </script>
  
  <div class="space-y-1">
    {#each tracks as track}
      <ListTrackCard
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