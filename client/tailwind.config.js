/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // StudyGen design system — soft playful, no harsh outlines
        ink: "#111111",
        muted: "#8A8F98",
        paper: "#FFFFFF",
        mist: "#F4F5F7",
        lavender: "#EFE9FF",
        mint: "#E9F9D8",
        peach: "#FFF1D6",
        sky: "#DDF0FF",
        tangerine: "#FFA94D",
        pinkpop: "#FF5FA2",
        amber: "#FFA31A",
        lilac: "#8B5CF6",
        skyblue: "#38BDF8",
        sun: "#FFD93D",
        berry: "#FF4D6D",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Manrope"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Plus Jakarta Sans"', '"Manrope"', "ui-sans-serif", "system-ui", "sans-serif"],
        body: ['"Plus Jakarta Sans"', '"Manrope"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        card: "0 8px 30px rgba(120,100,200,0.10)",
        "card-lg": "0 16px 48px -12px rgba(120,100,200,0.18)",
        glow: "0 10px 28px -6px rgba(255,95,162,0.55), 0 6px 18px -6px rgba(255,169,77,0.5)",
      },
    },
  },
  plugins: [],
};
