/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0a2540', // Deep Navy (Resumly)
          hover: '#081c31',
        },
        secondary: {
          DEFAULT: '#6366f1', // Indigo/Sky accent
          hover: '#4f46e5',
        },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        accent: '#00d4ff', // Sky blue glow
        fuchsia: {
          50: '#fdf4ff',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
        },
        light: '#f8fafc',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        arabic: ['"IBM Plex Sans Arabic"', 'inter', 'system-ui', 'sans-serif'], // Added Inter as a fallback for Arabic consistency
      },
      boxShadow: {
        'premium': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'premium-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'electric': '0 0 20px rgba(99, 102, 241, 0.4)',
      },
      borderRadius: {
        'capsule': '9999px',
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
  corePlugins: {},
}
