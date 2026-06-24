/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        ink: '#1c1c1e',
        panel: '#ffffff',
        canvas: '#f4f5f7',
        muted: '#8a8a8e',
        line: '#e5e6eb',
        accent: '#534ab7',
      },
    },
  },
  plugins: [],
}
