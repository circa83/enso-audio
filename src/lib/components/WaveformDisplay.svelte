<script lang="ts">
    export let container: HTMLDivElement | undefined = undefined;
  </script>
  
  <!-- Waveform container with same styling as original -->
  <div 
    bind:this={container}
    class="w-full bg-enso-bg-primary"
  >
    <!-- WaveSurfer will render its waveform here -->
  </div>