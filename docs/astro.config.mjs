import { $ } from 'zx'
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeSlug from 'rehype-slug'
import { h } from 'hastscript'

if (!process.env.VERCEL) await $`tsx sync-readme-to-pages.ts`

const AnchorLinkIcon = h(
  'span',
  { ariaHidden: 'true', class: 'anchor-icon' },
  h(
    'svg',
    { width: 16, height: 16, viewBox: '0 0 24 24' },
    h('path', {
      fill: 'currentcolor',
      d: 'm12.11 15.39-3.88 3.88a2.52 2.52 0 0 1-3.5 0 2.47 2.47 0 0 1 0-3.5l3.88-3.88a1 1 0 0 0-1.42-1.42l-3.88 3.89a4.48 4.48 0 0 0 6.33 6.33l3.89-3.88a1 1 0 1 0-1.42-1.42Zm8.58-12.08a4.49 4.49 0 0 0-6.33 0l-3.89 3.88a1 1 0 0 0 1.42 1.42l3.88-3.88a2.52 2.52 0 0 1 3.5 0 2.47 2.47 0 0 1 0 3.5l-3.88 3.88a1 1 0 1 0 1.42 1.42l3.88-3.89a4.49 4.49 0 0 0 0-6.33ZM8.83 15.17a1 1 0 0 0 1.1.22 1 1 0 0 0 .32-.22l4.92-4.92a1 1 0 0 0-1.42-1.42l-4.92 4.92a1 1 0 0 0 0 1.42Z',
    }),
  ),
)

const autolinkConfig = {
  properties: { class: 'anchor-link' },
  behavior: 'after',
  group: ({ tagName }) =>
    h('div', { tabIndex: -1, class: `heading-wrapper level-${tagName}` }),
  content: () => [AnchorLinkIcon],
}

// https://astro.build/config
export default defineConfig({
  site: 'https://www.reatom.dev',
  output: 'static',
  redirects: {
    '/core': '/package/core',
  },
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
          label: 'Examples',
          link: 'examples',
        },
        {
          label: 'Handbook',
          link: 'handbook',
        },
        {
          label: 'Recipes',
          autogenerate: {
            directory: 'recipes',
          },
        },
        {
          label: 'Packages',
          autogenerate: {
            directory: 'package',
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
        {
          label: 'Contributing',
          link: 'contributing',
        },
      ],
      components: {
        MarkdownContent: './src/components/MarkdownContent.astro',
      },
    }),
  ],
  // Process images with sharp: https://docs.astro.build/en/guides/assets/#using-sharp
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
  },
  markdown: {
    rehypePlugins: [
      [
        rehypeExternalLinks,
        {
          contentProperties: { className: ['external-link-icon'] },
          content: (node) => {
            const imgChild = node.children.find((c) => c.tagName === 'img')

            return imgChild
              ? undefined
              : {
                  type: 'text',
                  value: '↗',
                }
          },
          target: '_blank',
        },
      ],
      rehypeSlug,
      [rehypeAutolinkHeadings, autolinkConfig],
    ],
  },
})
