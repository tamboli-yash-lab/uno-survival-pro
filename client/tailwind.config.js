/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
         uno: {
           red: '#f56462',
           blue: '#0055aa',
           green: '#55aa55',
           yellow: '#ffaa00',
           black: '#222222',
           bg: '#1a1a1a'
         }
      },
      fontFamily: {
         sans: ['Outfit', 'Inter', 'sans-serif']
      },
      animation: {
         'wiggle': 'wiggle 0.3s ease-in-out infinite',
         'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
         wiggle: {
            '0%, 100%': { transform: 'rotate(-3deg)' },
            '50%': { transform: 'rotate(3deg)' },
         }
      }
    },
  },
  plugins: [],
}
