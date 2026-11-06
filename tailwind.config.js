/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/views/**/*.ejs"],
  theme: {
    extend: {
      colors: {
        garageDark: '#09090b',
        garageCard: '#18181b',
        garageGold: '#d97706',
      }
    },
  },
  plugins: [],
}