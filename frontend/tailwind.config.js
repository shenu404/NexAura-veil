/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0e8ff',
          100: '#d9c4ff',
          200: '#bb94ff',
          300: '#9d64ff',
          400: '#8040ff',
          500: '#6a1fd4',
          600: '#530fa8',
          700: '#3d0880',
          800: '#280558',
          900: '#130230',
        },
        surface: {
          900: '#0a0612',
          800: '#110920',
          700: '#1a1030',
          600: '#241640',
          500: '#2e1c52',
        }
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M0 0h40v1H0zM0 0v40h1V0z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      }
    }
  },
  plugins: []
}
