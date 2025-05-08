<script lang="ts">
    export let src: string;
    export let alt = '';
    
    let imageError = false;
    
    function handleError() {
      imageError = true;
      console.log('AlbumArt.svelte - Image load error:', src);
    }
  </script>
  
  <div class="w-full aspect-square border border-enso-border bg-enso-bg-secondary overflow-hidden">
    {#if !imageError && src}
      <img 
        {src} 
        {alt} 
        class="w-full h-full object-cover"
        on:error={handleError}
      />
    {:else}
      <div class="w-full h-full flex items-center justify-center">
        <div class="text-center">
          <svg 
            width="64" 
            height="64" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            class="mx-auto text-enso-border"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1" />
            <circle cx="8.5" cy="8.5" r="1.5" stroke-width="1" />
            <path d="M21 15l-5-5L5 21" stroke-width="1" />
          </svg>
          <p class="mt-4 text-xs uppercase tracking-wider text-enso-text-secondary">
            No Artwork
          </p>
        </div>
      </div>
    {/if}
  </div>