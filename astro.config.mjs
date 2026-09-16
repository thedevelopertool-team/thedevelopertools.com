// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://thedevelopertools.com',
  redirects: {
    '/privacy': '/privacy-policy',
    '/terms': '/terms-and-conditions',
    '/about': '/about-us',
    '/contact': '/contact-us',
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !page.endsWith('/404') &&
        !page.endsWith('/404/') &&
        !page.endsWith('/500') &&
        !page.endsWith('/500/'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});

