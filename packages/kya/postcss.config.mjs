// Tailwind 4 ships its own PostCSS plugin — no autoprefixer needed
// (Tailwind handles it internally).
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
