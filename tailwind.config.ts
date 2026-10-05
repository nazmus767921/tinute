import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-canvas)',
        surface: 'var(--color-surface)',
        border: { DEFAULT: 'var(--color-border)', subtle: 'var(--color-border-subtle)' },
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        accent: {
          DEFAULT: 'var(--color-accent)',
          contrast: 'var(--color-accent-contrast)',
          hover: 'var(--color-accent-hover)',
        },
        savings: {
          DEFAULT: 'var(--color-savings)',
          text: 'var(--color-savings-text)',
          bg: 'var(--color-savings-bg)',
        },
        lossy: {
          DEFAULT: 'var(--color-lossy)',
          text: 'var(--color-lossy-text)',
          bg: 'var(--color-lossy-bg)',
        },
        comic: {
          yellow: 'var(--color-comic-yellow)',
          pink: 'var(--color-comic-pink)',
          cyan: 'var(--color-comic-cyan)',
          lime: 'var(--color-comic-lime)',
          purple: 'var(--color-comic-purple)',
          ink: 'var(--color-comic-ink)',
          card: 'var(--color-comic-card)',
          shadow: 'var(--color-comic-shadow)',
        },
        arcade: {
          cyan: 'var(--color-arcade-cyan)',
          pink: 'var(--color-arcade-pink)',
          yellow: 'var(--color-arcade-yellow)',
          neon: 'var(--color-arcade-neon)',
          card: 'var(--color-arcade-card)',
        },
      },
      borderRadius: {
        control: '10px',
        card: '16px',
        comic: '18px',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        comic: '3px 3px 0px 0px var(--color-comic-shadow)',
        'comic-sm': '2px 2px 0px 0px var(--color-comic-shadow)',
        'comic-lg': '5px 5px 0px 0px var(--color-comic-shadow)',
        'comic-cyan': '3px 3px 0px 0px var(--color-comic-cyan)',
        'comic-pink': '3px 3px 0px 0px var(--color-comic-pink)',
        'comic-yellow': '3px 3px 0px 0px var(--color-comic-yellow)',
        arcade: '3px 3px 0px 0px var(--color-comic-shadow)',
        'arcade-sm': '2px 2px 0px 0px var(--color-comic-shadow)',
        'arcade-border': '0 0 0 2px var(--color-border)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'Geist Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
