<script lang="ts">
    import Player from '$lib/player/Player.svelte';
    
    // Demo track for testing - replace with your actual track
    const demoTrack = {
      src: './audio/February2(short)_2025.mp3', // You'll need to add this file to your static folder
      title: 'Ambient Demo Track'
    };
  </script>
  
  <div class="min-h-screen bg-enso-bg-primary p-8">
    <header class="mb-12">
      <h1 class="text-4xl font-thin tracking-[8px] mb-2">ENSŌ AUDIO</h1>
      <p class="text-enso-text-secondary uppercase tracking-[4px] text-sm">Ambient Archive</p>
    </header>
    
    <div class="enso-container p-8 max-w-3xl mx-auto">
      <Player src={demoTrack.src} title={demoTrack.title} />
    </div>
  </div>