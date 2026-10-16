import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0e14',
        panel: '#111622',
        panel2: '#161c2b',
        line: '#222a3d',
        muted: '#7c8599',
        gold: '#e6b450',
        bull: '#26a69a',
        bear: '#ef5350',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
