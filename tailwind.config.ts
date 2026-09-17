import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bucket: {
          bg: "#0b0f14",
          surface: "#131923",
          border: "#1f2733",
          text: "#e6ebf1",
          muted: "#8794a3",
          orange: "#f97316",
          "orange-dim": "#c2570f",
          win: "#22c55e",
          loss: "#ef4444",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
