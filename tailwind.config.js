/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'space': ['"Space Grotesk"', 'sans-serif'],
        'mono': ['"JetBrains Mono"', 'monospace'],
        'inter': ['Inter', 'sans-serif'],
      },
      colors: {
        'space': {
          950: '#030014',
          900: '#0a0a23',
          800: '#0f0f3d',
          700: '#1a1a5e',
        },
        'cosmic': {
          blue: '#4f8ef7',
          purple: '#8b5cf6',
          cyan: '#22d3ee',
          orange: '#f97316',
          yellow: '#fbbf24',
        }
      },
      animation: {
        'twinkle': 'twinkle 3s ease-in-out infinite',
        'meteor': 'meteor 8s linear infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        twinkle: {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
        meteor: {
          '0%': { transform: 'rotate(215deg) translateX(0)', opacity: '1' },
          '70%': { opacity: '1' },
          '100%': { transform: 'rotate(215deg) translateX(-500px)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(79, 142, 247, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(79, 142, 247, 0.8), 0 0 40px rgba(79, 142, 247, 0.3)' },
        },
      },
      backgroundImage: {
        'space-gradient': 'radial-gradient(ellipse at center, #0f0f3d 0%, #030014 100%)',
        'nebula': 'radial-gradient(ellipse at 20% 50%, rgba(79, 142, 247, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
};
