<script lang="ts">
    // This could be populated from a CMS or content file in the future
    const aboutText = `
    Audio Rituals are somatic listening practices that connect sound and sensation for personal transformation.

    `;

    const ritualSteps = [
      {
        title: 'Initiation',
        description: 'Setting a clear intention and signaling the nervous system that a shift is about to occur'
      },
      {
        title: 'Invocation',
        description: 'The anchoring of attention to the deep listening of sensations in the body'
      },
      {
        title: 'Integration',
        description: 'Seal the session by acknowledging the shift, and quietly commit to return again tomorrow: power grows with repetition'
      }
    ];
  </script>
  
  <section class="audioRituals-section py-20 px-4 border-b border-enso-border">
    <div class="max-w-4xl mx-auto">
      <h2 class="text-2xl uppercase tracking-[4px] font-light text-center mb-12">What are Audio Rituals?</h2>
      
      <div class="flex flex-col md:flex-row gap-12 justify-center items-start mx-auto max-w-4xl">
        <!-- About text -->
        <div class="md:w-2/3 space-y-8">
          <p class="text-enso-text-primary tracking-wide leading-relaxed">
            {aboutText}
          </p>
          
          <div class="space-y-8">
            {#each ritualSteps as step, i}
              <div class="feature-item">
                <div class="flex items-start gap-4">
                  <span class="text-xs font-mono text-enso-text-secondary">{(i + 1).toString().padStart(2, '0')}</span>
                  <div>
                    <h3 class="text-sm uppercase tracking-[2px] font-light mb-2">{step.title}</h3>
                    <p class="text-sm text-enso-text-secondary tracking-wide">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </section>