/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        inter:   ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        ui:      ['Inter', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        sm:         'calc(var(--radius) - 4px)',
        md:         'calc(var(--radius) - 2px)',
        lg:         'var(--radius)',
        xl:         'calc(var(--radius) + 4px)',
        '2xl':      'calc(var(--radius) + 10px)',
        '3xl':      'calc(var(--radius) + 16px)',
        'nexus-sm': '6px',
        'nexus-md': '8px',
        'nexus-lg': '10px',
      },
      colors: {
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border:  'hsl(var(--border))',
        input:   'hsl(var(--input))',
        ring:    'hsl(var(--ring))',
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT:             'hsl(var(--sidebar-background))',
          foreground:          'hsl(var(--sidebar-foreground))',
          primary:             'hsl(var(--sidebar-primary))',
          'primary-foreground':'hsl(var(--sidebar-primary-foreground))',
          accent:              'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border:              'hsl(var(--sidebar-border))',
          ring:                'hsl(var(--sidebar-ring))',
        },
        gold: {
          DEFAULT: '#C9A84C',
          light:   '#FBF3E0',
          dark:    '#9A7320',
        },
        navy: {
          DEFAULT: '#1B2B4A',
          hover:   '#243760',
          light:   '#EAF0FB',
        },
        app: {
          bg:      '#F0F2F5',
          surface: '#FFFFFF',
          hover:   '#E8EBF2',
        },
        border: {
          subtle:  '#DDE1EA',
          light:   '#E4E8F0',
        },
      },
      boxShadow: {
        'xs':     '0 1px 2px 0 rgb(15 23 42 / 0.05)',
        'card':   '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.04)',
        'card-md':'0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.04)',
        'card-lg':'0 8px 24px -4px rgb(15 23 42 / 0.10), 0 4px 8px -4px rgb(15 23 42 / 0.05)',
        'modal':  '0 20px 60px -8px rgb(15 23 42 / 0.20), 0 8px 20px -8px rgb(15 23 42 / 0.10)',
        'primary':'0 4px 14px -2px hsl(220 70% 40% / 0.30)',
        'sidebar':'4px 0 24px 0 rgb(0 0 0 / 0.20)',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        'display': ['2rem',   { lineHeight: '1.15', letterSpacing: '-0.025em', fontWeight: '700' }],
        'h1':      ['1.75rem', { lineHeight: '1.2',  letterSpacing: '-0.022em', fontWeight: '700' }],
        'h2':      ['1.375rem',{ lineHeight: '1.3',  letterSpacing: '-0.018em', fontWeight: '600' }],
        'h3':      ['1.125rem',{ lineHeight: '1.4',  letterSpacing: '-0.014em', fontWeight: '600' }],
        'body-lg': ['0.9375rem',{ lineHeight: '1.6' }],
        'body':    ['0.875rem', { lineHeight: '1.55' }],
        'body-sm': ['0.8125rem',{ lineHeight: '1.5' }],
        'caption': ['0.6875rem',{ lineHeight: '1.45', letterSpacing: '0.01em' }],
        'label':   ['0.6875rem',{ lineHeight: '1', letterSpacing: '0.06em', fontWeight: '600' }],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-in':        'fade-in 0.18s ease-out',
        'scale-in':       'scale-in 0.15s ease-out',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
