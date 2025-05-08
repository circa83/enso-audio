/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        'enso-bg-primary': '#181818',
        'enso-bg-secondary': '#1c1c1c',
        'enso-border': '#333333',
        'enso-text-primary': '#ffffff',
        'enso-text-secondary': '#aaaaaa',
        'enso-accent': '#ffffff',
      },
      fontFamily: {
        'archivo': ['Archivo', 'sans-serif'],
        'mono': ['Space Mono', 'monospace'],
      },
      letterSpacing: {
        'tight': '1px',
        'wide': '2px',
        'wider': '4px',
        'widest': '8px',
      },
      transitionDuration: {
        '200': '200ms',
        '300': '300ms',
      }
    },
  },
  plugins: [],
}