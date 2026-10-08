import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0a0a0a", 900: "#0a0a0a", 800: "#131312", 700: "#1b1a18" },
        line: { DEFAULT: "#2b2823", strong: "#3a362f" },
        paper: "#f4f1ea",
        muted: "#a39d91",
        dim: "#6f6a61",
        gold: { DEFAULT: "#C39443", hi: "#d9ad5e", ink: "#120e06" },
        ok: "#7fb48a",
        warn: "#e0954a",
        bad: "#d06a5f",
      },
      fontFamily: {
        display: ["var(--font-display)", "Arial Narrow", "Impact", "sans-serif"],
        sans: ["var(--font-body)", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "Menlo", "monospace"],
      },
      borderRadius: { DEFAULT: "4px" },
      maxWidth: { wrap: "1240px" },
      aspectRatio: { card: "63 / 88" },
    },
  },
  plugins: [],
} satisfies Config;
