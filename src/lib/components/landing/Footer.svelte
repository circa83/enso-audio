<script lang="ts">
    const currentYear = new Date().getFullYear();
  </script>
  
  <footer class="py-8 px-4">
    <div class="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center">
      <div class="mb-4 sm:mb-0">
        <span class="text-xs uppercase tracking-[2px] text-enso-text-secondary">
          &copy; {currentYear} Brock Cooper
        </span>
      </div>
      
      <nav>
        <ul class="flex gap-6">
          <li>
            <a 
              href="/landing" 
              class="text-xs uppercase tracking-[2px] text-enso-text-secondary hover:text-enso-text-primary
                    transition-colors duration-200"
            >
              Home
            </a>
          </li>
          <li>
            <a 
              href="/app" 
              class="text-xs uppercase tracking-[2px] text-enso-text-secondary hover:text-enso-text-primary
                    transition-colors duration-200"
            >
              App
            </a>
          </li>
          <li>
            <a 
              href="/privacy" 
              class="text-xs uppercase tracking-[2px] text-enso-text-secondary hover:text-enso-text-primary
                    transition-colors duration-200"
            >
              Privacy
            </a>
          </li>
        </ul>
      </nav>
    </div>
  </footer>