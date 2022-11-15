import { $ } from 'zx'
import { defineConfig } from 'astro/config'
import vercel from '@astrojs/vercel/serverless'
import prefetch from '@astrojs/prefetch'
import sitemap from '@astrojs/sitemap'

if (!process.env.VERCEL) await $`tsx sync-readme-to-pages.ts`

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [prefetch(), sitemap()],
})
