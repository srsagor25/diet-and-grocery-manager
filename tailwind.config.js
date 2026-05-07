/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f4ede0",
        ink: "#2a2419",
        "ink-muted": "#6b5a3e",
        accent: "#c44827",
        good: "#4a6b3e",
      },
      fontFamily: {
        display: ['"Bodoni Moda"', "serif"],
        body: ['"EB Garamond"', "serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
