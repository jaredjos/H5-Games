import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    react(),
    mode === 'internal'
      ? {
          name: 'nighttrace-internal-noindex',
          transformIndexHtml() {
            return [
              {
                tag: 'meta',
                attrs: {
                  name: 'robots',
                  content: 'noindex,nofollow,noarchive',
                },
                injectTo: 'head',
              },
            ]
          },
        }
      : null,
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
    manifest: true,
  },
}))
