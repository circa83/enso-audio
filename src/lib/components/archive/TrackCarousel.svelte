<script lang="ts">
  import type { Track } from '$lib/types/track';
  import GridTrackCard from './GridTrackCard.svelte';
  
  export let title: string = '';
  export let subtitle: string = '';
  export let tracks: Track[] = [];
  export let expandedTrackId: string | null = null;
  export let imageErrors: Record<string, boolean> = {};
  export let onTrackClick: (track: Track) => void;
  export let playNow: (track: Track) => void;
  export let onImageError: (trackId: string) => void;
  export let isCurrentTrack: (trackId: string) => boolean;
  export let isInSession: (trackId: string) => boolean;
  
  let carouselContainer: HTMLDivElement;
  
  let showLeftButton = false;
  let showRightButton = true;
  
  function scrollCarousel(direction: 'left' | 'right') {
    console.log('TrackCarousel.svelte - scrollCarousel', direction);
    if (!carouselContainer) return;
    
    const scrollAmount = 200; // Width of one track card + gap
    const currentScroll = carouselContainer.scrollLeft;
    
    carouselContainer.scrollTo({
      left: direction === 'right' 
        ? currentScroll + scrollAmount 
        : currentScroll - scrollAmount,
      behavior: 'smooth'
    });
  }
  
  function handleScroll() {
    if (!carouselContainer) return;
    
    showLeftButton = carouselContainer.scrollLeft > 0;
    showRightButton = carouselContainer.scrollLeft < 
      carouselContainer.scrollWidth - carouselContainer.clientWidth;
  }
</script>

<div class="carousel-section">
  <!-- Section Header -->
  <!-- {#if title || subtitle}
    <div class="mb-4">
      {#if title}
        <h3 class="text-lg font-thin tracking-wider uppercase mb-1">{title}</h3>
      {/if}
      {#if subtitle}
        <p class="text-sm text-enso-text-secondary">{subtitle}</p>
      {/if}
    </div>
  {/if} -->
  
  <!-- Carousel Container -->
  <div class="relative">
    <!-- Left scroll button -->
    {#if showLeftButton}
      <button
        on:click={() => scrollCarousel('left')}
        class="absolute left-0 top-1/3 -translate-y-1/2 z-20
               bg-enso-bg-primary border border-enso-border
               w-10 h-20 flex items-center justify-center
               hover:bg-enso-bg-secondary transition-all duration-200
               opacity-70 hover:opacity-100"
        aria-label="Scroll left"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M15 18l-6-6 6-6" stroke-width="1" />
        </svg>
      </button>
    {/if}
    
    <!-- Right scroll button -->
    {#if showRightButton}
      <button
        on:click={() => scrollCarousel('right')}
        class="absolute right-0 top-1/3 -translate-y-1/2 z-20
               bg-enso-bg-primary border border-enso-border
               w-10 h-20 flex items-center justify-center
               hover:bg-enso-bg-secondary transition-all duration-200
               opacity-70 hover:opacity-100"
        aria-label="Scroll right"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M9 18l6-6-6-6" stroke-width="1" />
        </svg>
      </button>
    {/if}
    
    <!-- Tracks Container -->
    <div
      bind:this={carouselContainer}
      on:scroll={handleScroll}
      class="overflow-x-auto scrollbar-hide pb-4"
    >
      <div class="flex gap-4">
        {#each tracks as track}
          <div class="flex-none w-48">
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
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  /* Hide scrollbar for Chrome, Safari and Opera */
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  
  /* Hide scrollbar for IE, Edge and Firefox */
  .scrollbar-hide {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
</style>