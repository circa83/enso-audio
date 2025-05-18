<script lang="ts">
    const contactLinks = [
      { 
        name: 'Email',
        url: 'mailto:hello@enso-audio.com', 
        icon: `<path d="M3 8l7.5 5.5L18 8M3 8v8l4.5-4.5M3 8V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z" stroke="currentColor" stroke-width="1" />` 
      },
      { 
        name: 'Instagram',
        url: 'https://instagram.com/bk.cp', 
        icon: `<rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" stroke-width="1" /><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1" /><circle cx="18" cy="6" r="1" fill="currentColor" />` 
      },
      { 
        name: 'YouTube',
        url: 'https://youtube.com/@brock.cooper', 
        icon: `<path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" stroke="currentColor" stroke-width="1" /><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" stroke="currentColor" stroke-width="1" />` 
      }
    ];
  </script>
  
  <section class="contact-section py-20 px-4 border-b border-enso-border">
    <div class="max-w-4xl mx-auto">
      <h2 class="text-2xl uppercase tracking-[4px] font-light text-center mb-12">Connect</h2>
      
      <div class="flex flex-wrap justify-center gap-8 md:gap-16">
        {#each contactLinks as link}
          <a 
            href={link.url} 
            target="_blank" 
            rel="noopener noreferrer"
            class="group flex flex-col items-center transition-all duration-200"
          >
            <div class="mb-3 w-12 h-12 border border-enso-border flex items-center justify-center
                        group-hover:bg-enso-bg-secondary transition-all duration-200">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                {@html link.icon}
              </svg>
            </div>
            <span class="text-xs uppercase tracking-[2px] text-enso-text-secondary group-hover:text-enso-text-primary">
              {link.name}
            </span>
          </a>
        {/each}
      </div>
      

    </div>
  </section>