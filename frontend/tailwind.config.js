/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        inter: ["Inter", "sans-serif"],
      },
      fontSize: {
        'page-title': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'section-title': ['22px', { lineHeight: '28px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'card-title': ['16px', { lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '16px', fontWeight: '500' }],
      },
      borderRadius: {
        'enterprise': '14px',
      },
      colors: {
        forge: {
          blue: "#0F4FA8",
          yellow: "#FFC107",
          navy: "#071B36",
          success: "#10B981",
          danger: "#EF4444",
          warning: "#F59E0B",
          purple: "#7C3AED",
          bg: "#F5F7FB",
          border: "#E7ECF5"
        }
      },
    },
  },
  plugins: [],
}
