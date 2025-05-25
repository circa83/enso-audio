<script lang="ts">
    const features = [
      {
        title: 'Ambient Archive',
        description: 'A living collection of listening experiences created to anchor attention and open space for inspiration.'
      },
      {
        title: 'Hand-Crafted Sound',
        description: '100 % original recorded performances, mindfully created; zero stock loops or AI shortcuts.'
      },
      {
        title: 'Weekly New Rituals',
        description: 'New listening experiences added every week to keeping the archive alive and your practice evolving.'
      }
    ];
  </script>
  
  <section class="app-showcase py-20 px-4 border-b border-enso-border bg-enso-bg-secondary">
    <div class="max-w-5xl mx-auto">
      <header class="text-center mb-16">
        <h2 class="text-2xl uppercase tracking-[4px] font-light mb-3">Ensō Audio</h2>
        <p class="text-enso-text-secondary tracking-[2px] text-sm max-w-2xl mx-auto">
          Audio Rituals for insight and transformation
        </p>
      </header>
      
      <div class="flex flex-col md:flex-row items-center gap-8 md:gap-12">
        <!-- App preview/mockup -->
        <div class="md:w-1/2 border border-enso-border bg-enso-bg-primary p-6">
          <!-- This could be replaced with an actual screenshot or mockup of your app -->
          <div class="aspect-[4/3] flex items-center justify-center">
         <div class="md:w-3/5">
    <img 
      src="/images/app_Preview.jpg" 
      alt="App Preview" 
      class="w-full max-w-3xl mx-auto"
    />
  </div>
          </div>
        </div>
        
        <!-- Features list -->
        <div class="md:w-1/2 space-y-8">
          {#each features as feature, i}
            <div class="feature-item">
              <div class="flex items-start gap-4">
                <span class="text-xs font-mono text-enso-text-secondary">{(i + 1).toString().padStart(2, '0')}</span>
                <div>
                  <h3 class="text-sm uppercase tracking-[2px] font-light mb-2">{feature.title}</h3>
                  <p class="text-sm text-enso-text-secondary tracking-wide">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          {/each}
          
          <div class="pt-6">
            <a 
              href="/app" 
              class="inline-block border border-enso-border px-6 py-3 uppercase tracking-[2px] text-xs
                    transition-all duration-200 hover:bg-enso-bg-secondary"
            >
             Start Listening
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>