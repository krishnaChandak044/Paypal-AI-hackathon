/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          50: '#FAF8F5',
          100: '#F5EFEB',
          200: '#EBE2D9',
          300: '#DDD1C4',
          400: '#BAA794',
          500: '#927C67',
          600: '#6E5C4B',
          700: '#524436',
          800: '#382E25',
          900: '#231D17',
        },
        clay: {
          50: '#FDF7F5',
          100: '#F9ECE7',
          200: '#F2D3C7',
          300: '#E7B29F',
          400: '#D78B71',
          500: '#C86D4D',
          600: '#B05335',
          700: '#924027',
          800: '#773523',
          900: '#642E20',
        },
        sage: {
          50: '#F5F7F5',
          100: '#E8ECE8',
          200: '#D2DBD2',
          300: '#B2C2B2',
          400: '#8DA38E',
          500: '#6D866E',
          600: '#556D56',
          700: '#455746',
          800: '#39473A',
          900: '#303B31',
        },
      },
      fontFamily: {
        serif: ['Lora', 'Georgia', 'serif'],
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2.25rem',
      },
      boxShadow: {
        'warm': '0 4px 20px -2px rgba(82, 68, 54, 0.06), 0 2px 6px -1px rgba(82, 68, 54, 0.04)',
        'warm-lg': '0 12px 32px -4px rgba(82, 68, 54, 0.08), 0 4px 12px -2px rgba(82, 68, 54, 0.04)',
      },
    },
  },
  plugins: [],
}
