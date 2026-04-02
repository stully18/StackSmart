import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0F1C',
        surface: {
          DEFAULT: '#111827',
          elevated: '#1F2937',
        },
        border: {
          DEFAULT: '#2D3748',
          subtle: '#1A2332',
        },
        primary: {
          DEFAULT: '#BEFF00',
          hover: '#D4FF40',
          muted: 'rgba(190, 255, 0, 0.10)',
        },
        accent: {
          violet: '#00D4AA',
          glow: 'rgba(190, 255, 0, 0.15)',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        destructive: '#EF4444',
        'text-primary': '#F0F4F8',
        'text-secondary': '#8B9DC3',
        'text-muted': '#5A6A85',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        serif: ['var(--font-instrument-serif)', 'Georgia', 'serif'],
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s ease-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'float': 'float 6s ease-in-out infinite',
        'fade-in-left': 'fade-in-left 0.5s ease-out',
        'fade-in-right': 'fade-in-right 0.5s ease-out',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(190, 255, 0, 0.1)' },
          '50%': { boxShadow: '0 0 30px rgba(190, 255, 0, 0.25)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'fade-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-right': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      backgroundImage: {
        'gradient-cta': 'linear-gradient(135deg, #BEFF00, #00D4AA)',
        'gradient-cta-hover': 'linear-gradient(135deg, #D4FF40, #33DDBB)',
      },
    },
  },
  plugins: [],
}
export default config
