/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Warm architectural stone & carbon ink (zero blue-slate AI tint)
        ink: {
          0: '#FFFFFF',
          50: '#F8F7F4',
          100: '#F1EFEA',
          200: '#E5E3DC',
          300: '#D4D1C7',
          400: '#9E9B91',
          500: '#6E6B63',
          600: '#4A4842',
          700: '#2C2B28',
          800: '#1E1E1C',
          850: '#161615',
          900: '#111110',
          950: '#0A0A09',
        },
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#3B82F6',
          500: '#1D4ED8',
          600: '#1E40AF',
          700: '#1E3A8A',
          800: '#172554',
          900: '#0F172A',
        },
        pos: '#15803D', // Deep banknote green
        neg: '#BE123C', // Ledger crimson
        warn: '#B45309', // Ochre amber
      },
      fontFamily: {
        sans: ['"Geist"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['"Geist"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(17, 17, 16, 0.03)',
        card: '0 1px 2px 0 rgba(17, 17, 16, 0.04)',
        pop: '0 12px 32px -4px rgba(17, 17, 16, 0.12), 0 4px 12px -2px rgba(17, 17, 16, 0.06)',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '6px',
        xl: '8px',
        card: '8px',
      },
    },
  },
  plugins: [],
}
