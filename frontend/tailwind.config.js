/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        forgeBlue: "#0B4EA2",
        forgeGold: "#FFC72C",
      },
    },
  },
  plugins: [],
}
