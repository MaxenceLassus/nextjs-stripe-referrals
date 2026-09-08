import type { Config } from 'tailwindcss';

/**
 * The demo app's styling. The referral module itself uses only these plain
 * utility classes, so dropping `src/referrals/` into a project that already
 * has Tailwind needs no config change; a project without Tailwind can restyle
 * the four components in `referrals/ui/` and touch nothing else.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe6ff',
          500: '#4f6ef7',
          600: '#3b55e0',
          700: '#2f43b4',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
