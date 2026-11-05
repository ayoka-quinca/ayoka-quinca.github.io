import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const artifact = process.env.VITE_ARTIFACT === '1';

export default defineConfig({
  base: artifact ? './' : '/',
  plugins: [
    react(),
    !artifact && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Ayoka Quinca – Gestion',
        short_name: 'Ayoka Quinca',
        description: 'Ventes, stock et crédits de la quincaillerie Ayoka Quinca',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#F7F4EE',
        theme_color: '#0B6E4F',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { navigateFallback: '/index.html', globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
});
