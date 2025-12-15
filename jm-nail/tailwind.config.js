/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans TC"', 'sans-serif'],
        serif: ['"Noto Serif TC"', 'serif'],
      },
      colors: {
        cream: {
          100: '#FDFCF8', // 溫柔米色背景
        }
      }
    },
  },
  plugins: [],
}