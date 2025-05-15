<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  // This is just a redirect page to your main application
  onMount(() => {
    if (browser) {
      window.location.href = '/';
    }
  });
</script>

<div class="min-h-screen bg-enso-bg-primary flex items-center justify-center">
  <p class="text-enso-text-secondary tracking-wider">Redirecting to Ensō Audio...</p>
</div>