/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12233D",
        teal: { DEFAULT: "#0F8B8D", light: "#E4F4F3" },
        amber: { DEFAULT: "#B45309", light: "#FDF3E2" },
        crimson: { DEFAULT: "#B3261E", light: "#FBE9E8" },
        surface: "#FFFFFF",
        canvas: "#F7F9FB",
        line: "#E4E8EE",
        text: { primary: "#1A2233", secondary: "#5B6472", muted: "#8993A3" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: { xl: "14px", "2xl": "20px" },
      boxShadow: {
        card: "0 1px 2px rgba(18,35,61,0.04), 0 4px 12px rgba(18,35,61,0.05)",
      },
    },
  },
  plugins: [],
}
