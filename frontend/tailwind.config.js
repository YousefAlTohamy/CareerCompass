/** @type {import('tailwindcss').Config} */
export default {
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
          600: '#475569',
          900: '#0f172a',
        },
        accent: '#00d4ff', // Sky blue glow
        light: '#f8fafc',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'premium': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'premium-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
      },
      borderRadius: {
        'capsule': '9999px',
      },
    },
  },
  plugins: [],
  corePlugins: {},
}
