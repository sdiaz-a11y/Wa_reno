/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        void: '#050505',
        surface: '#0c0c0e',
        emerald: {
          glow: '#34e0a1',
        },
        violet: {
          glow: '#8b7bff',
        },
      },
      borderRadius: {
        squircle: '2rem',
      },
      transitionTimingFunction: {
        fluid: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: 0, transform: 'translateY(2.5rem)', filter: 'blur(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
        },
        'orb-drift': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(3%, -4%) scale(1.08)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 900ms cubic-bezier(0.32,0.72,0,1) forwards',
        'orb-drift': 'orb-drift 18s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
