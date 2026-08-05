import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/maneger-time-worker-for-resturant/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'זמן צוות — ניהול שעות',
        short_name: 'זמן צוות',
        description: 'מערכת לניהול שעות העובדים במסעדה',
        theme_color: '#123c32',
        background_color: '#f4f7f5',
        display: 'standalone',
        lang: 'he',
        dir: 'rtl',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
});
