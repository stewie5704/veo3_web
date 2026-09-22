/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'sans-serif'],
        mono: ['ui-monospace', 'Menlo', 'Monaco', 'monospace'],
      },
      colors: {
        dark: {
          bg: '#09090b',
          surface: '#121217',
          card: '#16161e',
          inset: '#0c0c10',
          border: 'rgba(255, 255, 255, 0.08)',
          borderSubtle: 'rgba(255, 255, 255, 0.04)',
        },
        brand: {
          orange: '#F97316',
          amber: '#F59E0B',
          pink: '#EC4899',
          violet: '#8B5CF6',
          emerald: '#10B981',
          cyan: '#06B6D4',
        }
      },
      boxShadow: {
        'glow-orange': '0 0 25px -4px rgba(249, 115, 22, 0.25)',
        'glow-brand': '0 0 30px -5px rgba(236, 72, 153, 0.25)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
