import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ytools.lwj619862787.workers.dev',
  output: 'server',
  adapter: cloudflare({
    compatibilityFlags: ['nodejs_compat'],
  }),
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ['@ffmpeg/ffmpeg', '@ffmpeg/core'],
    },
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core'],
    },
  },
});
