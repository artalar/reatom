import { $ } from 'zx'
import { defineConfig } from 'astro/config'
import vercel from '@astrojs/vercel/serverless'

if (!process.env.VERCEL) await $`tsx sync-readme-to-pages.ts`

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
})
