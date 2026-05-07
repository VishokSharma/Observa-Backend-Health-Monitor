import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: "#1b4d3e",
        "primary-bright": "#11d411",
        ink: "#0f172a",
        paper: "#f5f5f0",
      },
      boxShadow: {
        hard: "4px 4px 0px 0px rgba(15,23,42,1)",
        "hard-sm": "2px 2px 0px 0px rgba(15,23,42,1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
