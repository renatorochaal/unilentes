/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#54A7D9',
          50:  '#EEF7FD',
          100: '#D6ECF8',
          200: '#ADD9F1',
          300: '#84C6EA',
          400: '#5BB3E3',
          500: '#54A7D9',
          600: '#3A8DC0',
          700: '#2C6D96',
          800: '#1E4D6C',
          900: '#0F2D42',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F8F9FA',
          muted:  '#F3F4F5',
        },
        text: {
          primary:     '#424752',
          secondary:   '#575F67',
          placeholder: '#727784',
          link:        '#54A7D9',
        },
        border: {
          DEFAULT: '#E0E4E8',
          strong:  '#C8CDD4',
        },
        danger: {
          DEFAULT: '#E53E3E',
          light:   '#FEE2E2',
        },
        success: {
          DEFAULT: '#38A169',
          light:   '#DCFCE7',
        },
        warning: {
          DEFAULT: '#D97706',
          light:   '#FEF3C7',
        },
      },
      boxShadow: {
        card:   '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-md': '0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.04)',
        'card-lg': '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)',
        login:  '0 20px 60px rgba(84,167,217,0.12), 0 4px 24px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        card: '12px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
