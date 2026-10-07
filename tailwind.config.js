/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Paleta no padrão DataCrazy: texto quase preto + azul de ação
        marinho: {
          DEFAULT: "#020817",
          50: "#f1f5f9",
          100: "#e2e8f0",
          600: "#1e293b",
          700: "#0f172a",
          800: "#020817",
          900: "#020617",
        },
        aco: {
          DEFAULT: "#3385FF",
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          500: "#3385FF",
          600: "#1f6fe5",
          700: "#1a5cc0",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(2,8,23,0.06)",
        cardhover: "0 8px 24px rgba(2,8,23,0.10)",
      },
    },
  },
  plugins: [],
};
