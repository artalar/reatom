import { unified } from '@astrojs/markdown-remark'
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import rehypeSlug from 'rehype-slug'
import starlightLinksValidator from 'starlight-links-validator'
import starlightLlmsTxt from 'starlight-llms-txt'

import { sidebar } from './astro.sidebar'
import { devServerFileWatcher } from './config/integrations/dev-server-file-watcher'
import { markdownBaseLinks } from './config/integrations/markdown-links-base'

const site = 'https://v1001.reatom.dev'
const ogImage = `${site}/assets/logo_text.png`
const siteDescription =
  'Atomic reactive state manager for JavaScript — simple to start, powerful for growth. Forms, routing, async, and framework adapters for React, Vue, and more.'

// https://astro.build/config
export default defineConfig({
  site,
  output: 'static',
  // Keep HTML-aware whitespace compression after Astro 7's JSX default.
  compressHTML: true,
  integrations: [
    devServerFileWatcher([
      './config/**', // Custom plugins and integrations
      './astro.sidebar.ts', // Sidebar configuration file
      './adapters.config.ts', // References configuration file
    ]),
    starlight({
      sidebar,
      plugins: [
        starlightLinksValidator({
          exclude: [
            // Custom reference routes are generated outside docsLoader.
            '/reference/**',
          ],
        }),
        starlightLlmsTxt({
          projectName: 'Reatom',
          description:
            'A state management library for JavaScript with atomic approach, powerful primitives, and framework integrations.',
          details: `Recommended reading order for LLM context:

1. **Summary** — compact overview of all Reatom APIs and patterns (best entry point)
2. **Getting Started** — step-by-step tutorials for core concepts
3. **Handbook** — advanced guides for routing, forms, async, persistence, and more
4. **Complete documentation** — full site dump when exhaustive coverage is needed

Use **Abridged documentation** (\`llms-small.txt\`) when context window is limited; it strips non-essential asides.`,
          customSets: [
            {
              label: 'Summary',
              description:
                'Compact overview of all Reatom features — best starting point for LLM context',
              paths: ['summary'],
            },
            {
              label: 'Getting Started',
              description:
                'Quick start tutorials — atoms, actions, extensions, forms, routing, and tooling',
              paths: ['start/**'],
            },
            {
              label: 'Handbook',
              description:
                'Comprehensive guides and advanced patterns for Reatom',
              paths: ['handbook/**'],
            },
          ],
          // Promote summary and start pages to top of full/small files
          promote: ['summary', 'index*', 'start/**'],
        }),
      ],
      components: {
        Header: './src/components/starlight/Header.astro',
        MobileMenuFooter: './src/components/starlight/MobileMenuFooter.astro',
        Sidebar: './src/components/starlight/Sidebar.astro',
        PageTitle: './src/components/starlight/PageTitle.astro',
        MarkdownContent: './src/components/MarkdownContent.astro',
      },
      title: 'Reatom',
      description: siteDescription,
      head: [
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: ogImage },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:alt', content: 'Reatom' },
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:image', content: ogImage },
        },
      ],
      // Prefer title/section hits for API-heavy docs search.
      pagefind: {
        ranking: {
          termSimilarity: 1.5,
          metaWeights: {
            title: 8,
          },
        },
      },
      logo: {
        src: './src/assets/logo_light.svg',
      },
      customCss: ['./src/styles/custom.css'],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/reatom/reatom/tree/v1001',
        },
        {
          icon: 'twitter',
          label: 'Twitter',
          href: 'https://twitter.com/reatomjs',
        },
        {
          icon: 'youtube',
          label: 'YouTube',
          href: 'https://www.youtube.com/playlist?list=PLXObawgXpIfxERCN8Lqd89wdsXeUHm9XU',
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/reatom/reatom/edit/v1001/docs/',
      },
    }),
    markdownBaseLinks(),
  ],
  // Process images with sharp: https://docs.astro.build/en/guides/assets/#using-sharp
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
  },
  markdown: {
    processor: unified({
      rehypePlugins: [rehypeSlug],
    }),
  },
})
