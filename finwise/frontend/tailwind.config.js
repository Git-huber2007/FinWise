/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Single source of truth for the fintech palette. Surfaces are neutral
        // so the data colours below are the only saturated thing on screen.
        brand:   { 50:'#eef4ff', 100:'#d9e6ff', 400:'#6b93f5', 500:'#3b6fe0', 600:'#2a55b8', 700:'#203f8a' },
        ink:     { 0:'#ffffff', 50:'#f7f8fa', 100:'#eceef2', 200:'#dcdfe6', 400:'#8b93a3', 600:'#4c5361', 800:'#232834', 900:'#161a22', 950:'#0e1116' },
        pos:     '#14936c',
        neg:     '#d64545',
        warn:    '#c98a1b',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)',
        pop:  '0 8px 24px rgba(16,24,40,.10)',
      },
      borderRadius: { card: '14px' },
    },
  },
  plugins: [],
}
