// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{js,jsx}", // Adjust as needed for your structure
  ],
  theme: {
    extend: {
      colors: {
        'gaming-black': '#0a0a0a',
        'gaming-dark': '#121212',
        'gaming-gray': '#1a1a1a',
        'gaming-yellow': '#FFD700',
        'gaming-yellow-dark': '#FFA500',
        'gaming-purple': '#B19CD9',
        'gaming-purple-dark': '#8B7AA8',
        'gaming-purple-light': '#E6E6FA',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(255, 215, 0, 0.5), 0 0 10px rgba(177, 156, 217, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(255, 215, 0, 0.8), 0 0 30px rgba(177, 156, 217, 0.5)' },
        }
      }
    },
  },
  plugins: [],
}
