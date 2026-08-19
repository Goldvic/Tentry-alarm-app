/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.js', './screens/**/*.{js,jsx}', './components/**/*.{js,jsx}', './navigation/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Trading-terminal-at-night palette. Near-black base so the
        // accent gradient (signal red -> magenta) actually pops, and a
        // "good/bad" pair that mirrors buy/sell candles instead of
        // generic green/red.
        bg: '#05070d',
        surface: '#10131f',
        surface2: '#161a2c',
        border: '#232a45',
        edge: '#2e3660',
        text: '#f5f6fb',
        dim: '#9ba3c4',
        faint: '#5c6488',
        buy: '#3ddc84',
        sell: '#ff4d6d',
        accent: '#ff3b5c',
        accent2: '#ff2d9e',
        warn: '#ffb020',
      },
      fontFamily: {
        mono: ['monospace'],
      },
    },
  },
  plugins: [],
};
