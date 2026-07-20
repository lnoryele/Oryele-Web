import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.oryele.ai',
  output: 'static',
  integrations: [sitemap()],
});
