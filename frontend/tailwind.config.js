/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        inter: ["Inter", "sans-serif"],
      },
      fontSize: {
        'page-title': ['36px', { lineHeight: '44px', letterSpacing: '-0.025em', fontWeight: '700' }],
        'portal-title': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'card-title': ['22px', { lineHeight: '28px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'section-heading': ['18px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'table-header': ['14px', { lineHeight: '20px', letterSpacing: '0.05em', fontWeight: '500' }],
        'body-text': ['15px', { lineHeight: '22px', fontWeight: '400' }],
        'secondary-text': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'kpi-number': ['44px', { lineHeight: '52px', letterSpacing: '-0.03em', fontWeight: '800' }],
        'btn-text': ['15px', { lineHeight: '20px', fontWeight: '600' }],
        'badge-text': ['13px', { lineHeight: '18px', fontWeight: '500' }],
        'sidebar-menu': ['16px', { lineHeight: '22px', fontWeight: '500' }],
        'sidebar-label': ['12px', { lineHeight: '16px', letterSpacing: '0.06em', fontWeight: '600' }],
        'form-label': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'input-text': ['15px', { lineHeight: '22px', fontWeight: '400' }],
      },
      colors: {
        forgeBlue: "#0B4EA2",
        forgeGold: "#FFC72C",
        slate: {
          500: "#64748B",
        }
      },
    },
  },
  plugins: [],
}
