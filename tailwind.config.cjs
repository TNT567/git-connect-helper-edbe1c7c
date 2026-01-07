module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0b0f1a",
        primary: "#00e5ff",
        accent: "#7c3aed"
      },
      boxShadow: {
        glow: "0 0 20px rgba(0, 229, 255, 0.3)"
      }
    }
  },
  plugins: []
}
