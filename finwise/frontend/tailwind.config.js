/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // High-craft fintech palette inspired by Stripe & Mercury (neutral-first, restrained)
        brand: {
          50: '#F0F5FF',
          100: '#E1ECFE',
          200: '#C7DCFE',
          300: '#A4C6FC',
          400: '#6FA4F8',
          500: '#2563EB', // Clean Institutional Blue
          600: '#1D4ED8',
          700: '#1E40AF',
          800: '#1E3A8A',
          900: '#172554',
        },
        ink: {
          0: '#FFFFFF',
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          850: '#171E2B',
          900: '#111827',
          950: '#0B0F17',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#14171F',
          darker: '#0D0E12',
          borderLight: '#E5E7EB',
          borderDark: '#222634',
        },
        pos: '#059669', // Clean Forest Emerald (not neon)
        neg: '#E11D48', // Clean Crimson Rose
        warn: '#D97706', // Clean Amber
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        pop: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        card: '14px',
      },
    },
  },
  plugins: [],
}
