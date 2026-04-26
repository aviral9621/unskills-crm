import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Group heavy third-party libs into long-lived shared chunks so
        // navigating between pages doesn't re-download them.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-router')) return 'vendor-router'
          if (id.includes('react-dom') || id.match(/[\\/]react[\\/]/) || id.includes('scheduler')) return 'vendor-react'
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
          if (id.includes('@tanstack')) return 'vendor-table'
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) return 'vendor-forms'
          if (id.includes('@react-pdf') || id.includes('pdf-lib') || id.includes('jspdf')) return 'vendor-pdf'
          if (id.includes('lucide-react')) return 'vendor-icons'
          if (id.includes('sonner') || id.includes('html2canvas') || id.includes('qrcode')) return 'vendor-ui'
          return 'vendor'
        },
      },
    },
  },
})
