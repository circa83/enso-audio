<script lang="ts">
    const features = [
      {
        title: 'Ambient Archive',
        description: 'Curated collection of ambient tracks designed for mindfulness and focus'
      },
      {
        title: 'Session Mode',
        description: 'Create custom listening sessions with seamless crossfades between tracks'
      },
      {
        title: 'Minimal Interface',
        description: 'Distraction-free listening experience with elegant waveform visualization'
      }
    ];
  </script>
  
  <section class="app-showcase py-20 px-4 border-b border-enso-border bg-enso-bg-secondary">
    <div class="max-w-5xl mx-auto">
      <header class="text-center mb-16">
        <h2 class="text-2xl uppercase tracking-[4px] font-light mb-3">Ensō Audio</h2>
        <p class="text-enso-text-secondary tracking-[2px] text-sm max-w-2xl mx-auto">
          A minimal ambient audio player designed for mindful listening experiences
        </p>
      </header>
      
      <div class="flex flex-col md:flex-row items-center gap-8 md:gap-12">
        <!-- App preview/mockup -->
        <div class="md:w-1/2 border border-enso-border bg-enso-bg-primary p-6">
          <!-- This could be replaced with an actual screenshot or mockup of your app -->
          <div class="aspect-[4/3] flex items-center justify-center">
            <div class="text-center">
              <p class="text-xs uppercase tracking-wider text-enso-text-secondary mb-4">
                App Preview
              </p>
              <div class="w-full h-40 border border-enso-border mb-4"></div>
              <div class="w-full h-6 border border-enso-border mb-4"></div>
              <div class="flex justify-between items-center">
                <div class="w-10 h-10 rounded-full border border-enso-border"></div>
                <div class="w-32 h-4 border border-enso-border"></div>
                <div class="w-16 h-4 border border-enso-border"></div>
              </div>
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
              Launch App
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>