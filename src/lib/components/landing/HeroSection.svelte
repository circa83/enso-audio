<script lang="ts">
  // Add any props or logic here
</script>

<section class="hero-section py-20 md:py-32 px-4 border-b border-enso-border">
  <div class="max-w-6xl mx-auto">
    <div class="flex flex-col md:flex-row items-center justify-between gap-12">
      <!-- Text content -->
      <div class="md:w-2/5 space-y-6 text-center">
        <img 
          src="/logo/bkcp_white.png" 
          alt="Ensō Audio" 
          class="h-16 mx-auto mb-1"
        />
        <p class="text-enso-text-secondary tracking-[2px] uppercase text-sm md:text-base">
         Sound Design for Transformation
        </p>
        <div class="pt-4">
          <a 
            href="/app" 
            class="inline-block border border-enso-border px-8 py-3 uppercase tracking-[3px] text-sm
                  transition-all duration-200 hover:bg-enso-bg-secondary"
          >
            Listen
          </a>
        </div>
      </div>
      
      <!-- Visual element -->
      <div class="md:w-3/5">
        <img 
          src="/images/hero.png" 
          alt="Ensō Audio" 
          class="w-full max-w-3xl mx-auto"
        />
      </div>
    </div>
  </div>
</section>