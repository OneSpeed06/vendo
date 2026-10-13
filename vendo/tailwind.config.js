/** Tailwind-config voor Vendo. Na het aanpassen van klassen: `npm run build:css` */
module.exports = {
  content: ['./index.html', './app/**/*.{html,js}', './dashboard/**/*.{html,js}', './shared/**/*.js'],
  darkMode: ['selector', '.theme-dark'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#fff7ed', 100: '#ffedd5', 400: '#fb923c', 500: '#ff6b00', 600: '#ea580c', 700: '#c2410c' },
        // Themakleuren (wisselen mee met licht/donker, zie shared/input.css)
        bg:    'rgb(var(--c-bg) / <alpha-value>)',
        card:  'rgb(var(--c-card) / <alpha-value>)',
        sub:   'rgb(var(--c-sub) / <alpha-value>)',
        line:  'rgb(var(--c-line) / <alpha-value>)',
        ink:   'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
