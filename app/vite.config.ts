import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const artifact = process.env.VITE_ARTIFACT === '1';
// Sous-dossier de publication (ex : « /ayoka-quinca/ » sur GitHub Pages). « / » par défaut.
const base = artifact ? './' : process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  // Lien de test : polices intégrées au CSS (aucun fichier externe à charger).
  build: { assetsInlineLimit: artifact ? 10_000_000 : 4096 },
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
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#F5F4F2',
        theme_color: '#141414',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { navigateFallback: `${base}index.html`, globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
});
