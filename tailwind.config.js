module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        card: '#111111',
        cardBorder: '#1f1f1f',
        cardHover: '#1a1a1a',
      },
      fontFamily: {
        'space': ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
};