/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,svelte}",
  ],
  theme: {
    extend: {
      colors: {
        'enso-bg-primary': '#181818',
        'enso-bg-secondary': '#1c1c1c',
        'enso-border': '#333333',
        'enso-text-primary': '#ffffff',
        'enso-text-secondary': '#aaaaaa',
        'enso-accent': '#ffffff'
      },
      fontFamily: {
        'archivo': ['Archivo', 'sans-serif'],
        'space-mono': ['Space Mono', 'monospace']
      },
      fontWeight: {
        'thin': '100',
        'extra-light': '200',
        'light': '300'
      },
      letterSpacing: {
        'normal': '0.1em',
        'wide': '0.2em',
        'wider': '0.4em',
        'widest': '0.8em'
      },
      transitionDuration: {
        '200': '200ms',
        '300': '300ms'
      }
    },
  },
  plugins: [],
}