import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        espresso: "#3B2418",
        coffee: "#6F4E37",
        cream: "#F5EFE6",
        warm: "#FFFDF9",
        caramel: "#C58B55",
        charcoal: "#24201D",
      },
      fontFamily: { sans: ["var(--font-poppins)", "system-ui", "sans-serif"] },
      borderRadius: { xl: "1rem", "2xl": "1.5rem" },
      boxShadow: { soft: "0 4px 20px -6px rgba(59,36,24,0.18)" },
    },
  },
  plugins: [],
};
export default config;
