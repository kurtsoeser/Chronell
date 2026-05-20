import tailwindcssAnimate from 'tailwindcss-animate'

/**
 * Account-Farben werden dynamisch aus String-Mappings angewandt (siehe
 * `src/renderer/src/lib/avatar-color.ts`). Tailwind erkennt die fertigen
 * Klassen wie `before:bg-blue-500` und `ring-blue-500` aus den Return-
 * Werten von Switch-Statements teils nicht zuverlaessig - daher sind sie
 * hier in der Safelist statisch hinterlegt.
 */
const ACCOUNT_COLOR_BASES = [
  'blue-500',
  'emerald-500',
  'violet-500',
  'amber-500',
  'rose-500',
  'cyan-500',
  'fuchsia-500',
  'teal-500',
  'indigo-500',
  'orange-500',
  'lime-600',
  'pink-500'
]

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    ...ACCOUNT_COLOR_BASES.flatMap((c) => [
      `bg-${c}`,
      `ring-${c}`,
      `before:bg-${c}`
    ])
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem'
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: {
          DEFAULT: 'hsl(var(--foreground))',
          secondary: 'hsl(var(--foreground-secondary))',
          muted: 'hsl(var(--foreground-muted))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))'
        },
        status: {
          unread: 'hsl(var(--status-unread))',
          todo: 'hsl(var(--status-todo))',
          waiting: 'hsl(var(--status-waiting))',
          flagged: 'hsl(var(--status-flagged))',
          done: 'hsl(var(--status-done))'
        }
      },
      borderRadius: {
        DEFAULT: 'var(--radius-sm)',
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-panel)',
        panel: 'var(--radius-panel)'
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' }
        },
        'star-pop': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.25)' },
          '100%': { transform: 'scale(1)' }
        },
        'toast-check-pop': {
          '0%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' }
        }
      },
      animation: {
        'pulse-soft': 'pulse-soft 1.8s ease-in-out infinite',
        'star-pop': 'star-pop 220ms ease-out',
        'toast-check-pop': 'toast-check-pop 250ms ease-out both'
      },
      fontFamily: {
        sans: ['var(--chronell-font-family)']
      },
      transitionTimingFunction: {
        chronell: 'var(--motion-ease)'
      },
      transitionDuration: {
        chronell: 'var(--motion-normal)'
      }
    }
  },
  plugins: [tailwindcssAnimate]
}
