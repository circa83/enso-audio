<script lang="ts">
    // This could be populated from a CMS or content file in the future
    const aboutText = `
      I create ambient compositions that explore the intersection of sound, technology, and mindfulness.
      My work aims to create immersive sonic environments that facilitate focus, meditation, and emotional 
      processing.
    `;
    
    const skills = [
      'Ambient Composition',
      'Sound Design',
      'Audio Programming',
      'Web Development',
      'Music Production'
    ];
  </script>
  
  <section class="about-section py-20 px-4 border-b border-enso-border">
    <div class="max-w-4xl mx-auto">
      <h2 class="text-2xl uppercase tracking-[4px] font-light text-center mb-12">About</h2>
      
      <div class="flex flex-col md:flex-row gap-12">
        <!-- About text -->
        <div class="md:w-2/3 space-y-4">
          <p class="text-enso-text-primary tracking-wide leading-relaxed">
            {aboutText}
          </p>
          
          <p class="text-enso-text-secondary tracking-wide leading-relaxed">
            Through Ensō Audio, I've created a platform that combines my passion for ambient music with my 
            background in software development, offering a unique approach to focused listening experiences.
          </p>
        </div>
        
        <!-- Skills list -->
        <div class="md:w-1/3">
          <h3 class="text-sm uppercase tracking-[3px] font-light mb-4 text-enso-text-secondary">
            Focus Areas
          </h3>
          <ul class="space-y-3">
            {#each skills as skill}
              <li class="text-sm tracking-wider border-l border-enso-border pl-4 py-1">
                {skill}
              </li>
            {/each}
          </ul>
        </div>
      </div>
    </div>
  </section>