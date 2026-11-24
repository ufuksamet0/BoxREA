/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        'primary-hover': '#2563eb',
        secondary: '#64748b',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        background: '#0f172a',
        surface: '#1e293b',
        'surface-hover': '#334155',
        border: '#334155',
        text: '#f1f5f9',
        'text-muted': '#94a3b8',
        'code-bg': '#020617',
      },
    },
  },
  plugins: [],
}