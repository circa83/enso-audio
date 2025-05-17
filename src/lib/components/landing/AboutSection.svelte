<script lang="ts">
    // This could be populated from a CMS or content file in the future
    const aboutText = `
     Brock Cooper is a Malibu-based composer dedicated to empowering wellness professionals through the art of sound.
      With a focus on Somatic Listening, he enhances practices 
     like meditation coaching, self-development, and psychedelic-assisted therapy.
    `;
    
    const skills = [
      'Ambient Composition',
      'Sound Design',
      'Audio Programming',
      'Web Development',
      'Music Production'
    ];
  </script>
  
  <section class="about-section  py-20 px-4 border-b border-enso-border">
    <div class="max-w-4xl mx-auto">
      <h2 class="text-2xl uppercase tracking-[4px] font-light text-center mb-12">About</h2>
      
           <div class="flex flex-col md:flex-row gap-12 justify-center items-center mx-auto max-w-4xl">
        <!-- About text -->
        <div class="md:w-2/3 space-y-4">
          <p class="text-enso-text-primary tracking-wide leading-relaxed">
            {aboutText}
          </p>
          
          <p class="text-enso-text-secondary tracking-wide leading-relaxed">
          "Somatic Listening is an exploration of presence—engaging with sound and sensation not as two separate things but as connected parts of the same experience.""
          </p>
        </div>
        
    
      </div>
    </div>
  </section>