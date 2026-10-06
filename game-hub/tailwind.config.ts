import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mirkuz: {
          blue: "#1D70F5",
          background: "#F8FAFC",
        },
        navy: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
        },
        subject: {
          physics: {
            bg: "#f0f9ff",
            text: "#0284c7",
            border: "#bae6fd",
          },
          chemistry: {
            bg: "#fdf2f8",
            text: "#db2777",
            border: "#fbcfe8",
          },
          mathematics: {
            bg: "#ecfdf5",
            text: "#059669",
            border: "#a7f3d0",
          },
          biology: {
            bg: "#f0fdf4",
            text: "#16a34a",
            border: "#bbf7d0",
          },
          english: {
            bg: "#f5f3ff",
            text: "#7c3aed",
            border: "#ddd6fe",
          },
          computer: {
            bg: "#ecfeff",
            text: "#0891b2",
            border: "#a5f3fc",
          },
        },
        telegram: {
          bg: "#17212b",
          secondary: "#242f3d",
          button: "#5288c1",
          text: "#ffffff",
        },
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
      },
      animation: {
        "pulse-fast": "pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bounce-slow": "bounce 2s infinite",
        "shake": "shake 0.5s ease-in-out",
        "combo": "combo 0.6s ease-out",
        "heart-beat": "heartbeat 0.3s ease-in-out",
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-5px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(5px)" },
        },
        combo: {
          "0%": { transform: "scale(1)", opacity: "0" },
          "50%": { transform: "scale(1.5)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "0" },
        },
        heartbeat: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.2)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
