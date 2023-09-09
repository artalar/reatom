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
      title: 'Reatom',
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
          label: 'Getting Started',
          autogenerate: {
            directory: 'getting-started',
          },
        },
        {
          label: 'Recipes',
          autogenerate: {
            directory: 'recipes',
          },
        },
        {
          label: 'Examples',
          link: 'examples',
        },
        {
          label: 'Handbook',
          link: 'handbook',
        },
        {
          label: 'Packages',
          autogenerate: {
            directory: 'packages',
          },
        },
        {
          label: 'REPL',
          link: 'repl',
        },
        {
          label: 'Compat',
          autogenerate: {
            directory: 'compat',
            collapsed: true,
          },
        },
      ],
    }),
  ],
  // Process images with sharp: https://docs.astro.build/en/guides/assets/#using-sharp
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
  },
})
