import { $ } from 'zx'
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

if (!process.env.VERCEL) await $`tsx sync-readme-to-pages.ts`

// https://astro.build/config
export default defineConfig({
  site: 'https://www.reatom.dev',
  output: 'static',
  integrations: [
    starlight({
      title: 'Reatom Docs',
      logo: {
        src: './src/assets/logo_light.svg',
      },
      social: {
        github: 'https://github.com/artalar/reatom',
        twitter: 'https://twitter.com/reatomjs',
        youtube:
          'https://www.youtube.com/playlist?list=PLXObawgXpIfxERCN8Lqd89wdsXeUHm9XU',
      },
      editLink: {
        baseUrl: 'https://github.com/artalar/reatom/edit/v3/docs/',
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Core',
          link: 'core',
        },
        {
          label: 'Examples',
          link: 'examples',
        },
        {
          label: 'Tutorial',
          link: 'tutorial',
        },
        {
          label: 'Guides',
          autogenerate: { directory: 'guides' },
        },
        {
          label: 'General',
          autogenerate: { directory: 'general' },
        },
        {
          label: 'Packages',
          autogenerate: { directory: 'package' },
        },
        {
          label: 'Adapters',
          autogenerate: { directory: 'adapter', collapsed: true },
        },
        {
          label: 'Compat',
          autogenerate: { directory: 'compat', collapsed: true },
        },
      ],
    }),
  ],

  // Process images with sharp: https://docs.astro.build/en/guides/assets/#using-sharp
  image: { service: { entrypoint: 'astro/assets/services/sharp' } },
})
