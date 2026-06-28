import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/fjtc-lottery': {
        target: 'https://www.fjtc.com.cn/data_api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fjtc-lottery/, ''),
      },
      '/zhcw-chart': {
        target: 'https://www.zhcw.com/chartstatic/json',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zhcw-chart/, ''),
      },
    },
  },
})
