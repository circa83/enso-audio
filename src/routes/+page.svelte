<script lang="ts">
    import HeroSection from '$lib/components/landing/HeroSection.svelte';
    import AboutSection from '$lib/components/landing/AboutSection.svelte';
    import AudioRituals from '$lib/components/landing/AudioRituals.svelte';
    import AppShowcase from '$lib/components/landing/AppShowcase.svelte';
    import ContactSection from '$lib/components/landing/ContactSection.svelte';
    import Footer from '$lib/components/landing/Footer.svelte';
    import { onMount } from 'svelte';
    
    onMount(() => {
      console.log('Root page (Landing) mounted - check if this appears in console');
    });
  </script>
  
  <div class="landing-page bg-enso-bg-primary min-h-screen">
    <HeroSection />
    <AboutSection />
    <AppShowcase />
    <AudioRituals />
    <ContactSection />
    <Footer />
  </div>