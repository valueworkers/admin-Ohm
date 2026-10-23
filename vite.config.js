import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createProductsApiMiddleware } from './server/productsApi.js'

// Local-only: Wix keys stay in process env (never VITE_ / never browser).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const wixKey = String(env.WIX_API_KEY || '').trim()
  const wixSiteId = String(env.WIX_SITE_ID || '').trim()
  const productsApi = createProductsApiMiddleware(env)

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'wix-products-api',
        configureServer(server) {
          server.middlewares.use(productsApi)
        },
        configurePreviewServer(server) {
          server.middlewares.use(productsApi)
        },
      },
    ],
    server: {
      proxy: {
        // Legacy proxy kept for any leftover /wix-api calls
        '/wix-api': {
          target: 'https://www.wixapis.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/wix-api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (wixKey) proxyReq.setHeader('Authorization', wixKey)
              if (wixSiteId) proxyReq.setHeader('wix-site-id', wixSiteId)
            })
          },
        },
      },
    },
  }
})
