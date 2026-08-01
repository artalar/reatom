import { join } from 'node:path'

import { isUnifiedProcessor, unified } from '@astrojs/markdown-remark'
import type { AstroIntegration } from 'astro'
import type { Root as MarkdownAstRoot } from 'mdast'
import { visit } from 'unist-util-visit'

export function markdownBaseLinks(): AstroIntegration {
  return {
    name: 'markdown-base-links',
    hooks: {
      'astro:config:setup': ({ config, updateConfig }) => {
        const baseLinksPlugin = [
          remarkBaseLinks,
          {
            base: config.base,
          },
        ] as const

        const processor = config.markdown.processor
        if (isUnifiedProcessor(processor)) {
          updateConfig({
            markdown: {
              processor: unified({
                remarkPlugins: [
                  ...(processor.options.remarkPlugins ?? []),
                  baseLinksPlugin,
                ],
                rehypePlugins: processor.options.rehypePlugins,
                remarkRehype: processor.options.remarkRehype,
                gfm: processor.options.gfm,
                smartypants: processor.options.smartypants,
              }),
            },
          })
          return
        }

        updateConfig({
          markdown: {
            processor: unified({
              remarkPlugins: [baseLinksPlugin],
            }),
          },
        })
      },
    },
  }
}

type Config = {
  base: string
}

export function remarkBaseLinks(config: Config) {
  return (tree: MarkdownAstRoot) => {
    visit(tree, (node) => {
      if (node.type !== 'link') return

      const url = node.url
      if (typeof url !== 'string' || url[0] != '/') return

      node.url = join(config.base, url)
    })
  }
}
