import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // Use 'nodejs20.x' which is a valid Vercel runtime
      runtime: 'nodejs20.x'
    })
  }
};

export default config;