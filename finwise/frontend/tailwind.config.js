/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // High-contrast, radiant modern slate & obsidian
        ink: {
          0: '#FFFFFF',
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          850: '#141B2D',
          900: '#0F172A',
          950: '#07090E',
        },
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        pos: '#10B981', // Banknote emerald
        neg: '#F43F5E', // Rose crimson
        warn: '#F59E0B', // Amber gold
      },
      fontFamily: {
        sans: ['"Geist"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['"Geist"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['"Geist"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        pop: '0 20px 40px -8px rgba(0, 0, 0, 0.24), 0 1px 3px rgba(0, 0, 0, 0.1)',
        glow: '0 0 20px -5px rgba(59, 130, 246, 0.3)',
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        card: '12px',
      },
    },
  },
  plugins: [],
}
