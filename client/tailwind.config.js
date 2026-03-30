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
          bg: '#0d0d14'
        },
        neon: {
          purple: '#9b59ff',
          blue: '#00c3ff',
          pink: '#ff2d78',
          green: '#00ff9f',
          gold: '#ffd700',
        },
        glass: {
          DEFAULT: 'rgba(255,255,255,0.05)',
          border: 'rgba(255,255,255,0.12)',
          strong: 'rgba(255,255,255,0.10)',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'Poppins', 'sans-serif'],
        display: ['"Bebas Neue"', 'cursive'],
        poppins: ['Poppins', 'sans-serif'],
      },
      backgroundImage: {
        'neon-gradient': 'linear-gradient(135deg, #9b59ff 0%, #00c3ff 100%)',
        'danger-gradient': 'linear-gradient(135deg, #ff2d78 0%, #f56462 100%)',
        'gold-gradient': 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)',
      },
      animation: {
        'wiggle':       'wiggle 0.3s ease-in-out infinite',
        'spin-slow':    'spin 4s linear infinite',
        'float':        'float 6s ease-in-out infinite',
        'float-delayed':'float 6s ease-in-out 2s infinite',
        'glow-pulse':   'glowPulse 2s ease-in-out infinite',
        'shimmer':      'shimmer 1.8s ease-in-out infinite',
        'border-spin':  'borderSpin 3s linear infinite',
        'slide-in-right':'slideInRight 0.35s cubic-bezier(0.4,0,0.2,1)',
        'slide-out-right':'slideOutRight 0.3s cubic-bezier(0.4,0,0.2,1)',
        'fade-in':      'fadeIn 0.4s ease-out',
        'scale-in':     'scaleIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        'bounce-in':    'bounceIn 0.6s cubic-bezier(0.34,1.56,0.64,1)',
        'ring-pulse':   'ringPulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%':      { transform: 'rotate(3deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%':      { transform: 'translateY(-18px) rotate(3deg)' },
          '66%':      { transform: 'translateY(-8px) rotate(-2deg)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.6' },
          '50%':      { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        borderSpin: {
          '0%':   { backgroundPosition: '0% 50%'},
          '100%': { backgroundPosition: '200% 50%'},
        },
        slideInRight: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',     opacity: '1' },
        },
        slideOutRight: {
          from: { transform: 'translateX(0)',     opacity: '1' },
          to:   { transform: 'translateX(100%)', opacity: '0' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        scaleIn: {
          from: { transform: 'scale(0.7)', opacity: '0' },
          to:   { transform: 'scale(1)',   opacity: '1' },
        },
        bounceIn: {
          from: { transform: 'scale(0.3) translateY(40px)', opacity: '0' },
          to:   { transform: 'scale(1)   translateY(0)',    opacity: '1' },
        },
        ringPulse: {
          '0%, 100%': { boxShadow: '0 0 15px 2px var(--ring-color)', opacity: '0.8' },
          '50%':      { boxShadow: '0 0 35px 8px var(--ring-color)', opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '4px',
      },
      boxShadow: {
        'neon-purple': '0 0 15px rgba(155,89,255,0.5), 0 0 30px rgba(155,89,255,0.2)',
        'neon-blue':   '0 0 15px rgba(0,195,255,0.5), 0 0 30px rgba(0,195,255,0.2)',
        'neon-pink':   '0 0 15px rgba(255,45,120,0.5), 0 0 30px rgba(255,45,120,0.2)',
        'neon-gold':   '0 0 15px rgba(255,170,0,0.5), 0 0 30px rgba(255,170,0,0.2)',
        'card-glow':   '0 8px 32px rgba(0,0,0,0.5)',
        'glass':       '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
      },
    },
  },
  plugins: [],
}
