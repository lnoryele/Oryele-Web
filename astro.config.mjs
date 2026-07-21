import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://oryele.ai',
  output: 'static',
  integrations: [sitemap()],
});
