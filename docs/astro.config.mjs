import { $ } from 'zx'
import { defineConfig } from 'astro/config'
import prefetch from '@astrojs/prefetch'
import sitemap from '@astrojs/sitemap'

if (!process.env.VERCEL) await $`tsx sync-readme-to-pages.ts`

// https://astro.build/config
export default defineConfig({
  site: 'https://www.reatom.dev',
  output: 'static',
  integrations: [prefetch(), sitemap()],
})
