/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Figtree", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        marinho: {
          DEFAULT: "#173A5E",
          50: "#eef3f8",
          100: "#d4e0ec",
          600: "#1d4a76",
          700: "#173A5E",
          800: "#112c47",
          900: "#0b1d30",
        },
        aco: {
          DEFAULT: "#2E78A8",
          50: "#eef6fb",
          100: "#d3e8f3",
          500: "#2E78A8",
          600: "#276690",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(23,58,94,0.08), 0 1px 2px rgba(23,58,94,0.06)",
        cardhover: "0 6px 20px rgba(23,58,94,0.12)",
      },
    },
  },
  plugins: [],
};
