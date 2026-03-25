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
        background: '#020617',
        surface: {
          DEFAULT: '#0F172A',
          elevated: '#1E293B',
        },
        border: {
          DEFAULT: '#334155',
          subtle: '#1E293B',
        },
        primary: {
          DEFAULT: '#2563EB',
          hover: '#3B82F6',
          muted: 'rgba(37, 99, 235, 0.12)',
        },
        accent: {
          violet: '#7C3AED',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        destructive: '#EF4444',
        'text-primary': '#F8FAFC',
        'text-secondary': '#94A3B8',
        'text-muted': '#64748B',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.4s ease-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(37, 99, 235, 0.1)' },
          '50%': { boxShadow: '0 0 30px rgba(37, 99, 235, 0.25)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      backgroundImage: {
        'gradient-cta': 'linear-gradient(135deg, #2563EB, #7C3AED)',
        'gradient-cta-hover': 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
      },
    },
  },
  plugins: [],
}
export default config
