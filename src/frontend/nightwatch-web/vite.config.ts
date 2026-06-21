import { execSync } from 'child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const gitCommit = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim() }
  catch { return 'unknown' }
})()

const appVersion = (() => {
  try { return JSON.parse(readFileSync('./package.json', 'utf-8')).version as string }
  catch { return '0.0.0' }
})()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __GIT_COMMIT__: JSON.stringify(gitCommit),
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router-dom/')) {
              return 'react';
            }

            if (id.includes('@azure/msal-browser') || id.includes('@azure/msal-react')) {
              return 'msal';
            }

            if (id.includes('/recharts/')) {
              return 'charts';
            }

            if (id.includes('/reactflow/')) {
              return 'flow';
            }

            if (id.includes('/jspdf/') || id.includes('/xlsx/') || id.includes('/html2canvas/')) {
              return 'export';
            }

            if (id.includes('/axios/')) {
              return 'http';
            }
          }

          return undefined;
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5092',
        changeOrigin: true,
      },
    },
  },
})
