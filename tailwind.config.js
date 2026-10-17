/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FA593C',
          dark: '#E84A2E',
          light: '#FFB8A8',
          50: '#FFF4F1',
          100: '#FFE6DF',
        },
        navy: {
          DEFAULT: '#383C47',
          light: '#5B5F6B',
          muted: '#8A8E99',
        },
      },
      fontFamily: {
        sans: ['Tajawal', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
