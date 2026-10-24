/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fef6ee',
          100: '#fdebd6',
          200: '#fad3ad',
          300: '#f6b479',
          400: '#f19043',
          500: '#ea7a24',   // naranja principal — más cálido y menos saturado que el Tailwind default
          600: '#d4600f',
          700: '#b04b0e',
          800: '#8c3c13',
          900: '#723313',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.35' },
        },
      },
    },
  },
  plugins: [],
}
