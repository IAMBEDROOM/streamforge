/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // StreamForge brand colors
        sf: {
          primary: "#6C3CE1",
          "primary-light": "#8B5CF6",
          "primary-dark": "#5529BD",
          accent: "#00D4AA",
          "accent-light": "#34E0BF",
          "accent-dark": "#00B892",
        },
        panel: {
          bg: "#0f1117",
          surface: "#181a20",
          border: "#2a2d37",
          hover: "#22252e",
        },
      },
    },
  },
  plugins: [],
};
