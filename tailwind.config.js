/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: "#020203", base: "#050506", elevated: "#0a0a0c" },
        surface: { DEFAULT: "#0c1628", card: "#0f1e35" },
        border: { DEFAULT: "#1a2d47" },
        accent: { DEFAULT: "#f59e0b", hover: "#d97706" },
        text: { DEFAULT: "#e2e8f0", secondary: "#607a99", dim: "#2a3f5a" },
        quad: {
          stars: "#f59e0b",
          cows: "#a78bfa",
          qmarks: "#2dd4bf",
          dogs: "#f87171",
        },
      },
      fontFamily: {
        heading: ["'Fira Code'", "monospace"],
        body: ["'Fira Sans'", "sans-serif"],
        mono: ["'Fira Code'", "monospace"],
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        ticker: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        pulse: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        orb1: {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(40px,-30px) scale(1.1)" },
        },
        orb2: {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(-30px,40px) scale(0.9)" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
      },
      animation: {
        "fade-up-1": "fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.1s both",
        "fade-up-2": "fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.22s both",
        "fade-up-3": "fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.34s both",
        "fade-up-4": "fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.46s both",
        "fade-up-5": "fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.58s both",
        "fade-in": "fadeIn 1s ease 0.1s both",
        ticker: "ticker 22s linear infinite",
        pulse: "pulse 2s ease infinite",
        orb1: "orb1 12s ease-in-out infinite",
        orb2: "orb2 16s ease-in-out infinite",
        scanline: "scanline 8s linear infinite",
      },
    },
  },
  plugins: [],
};
