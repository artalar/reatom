import { defineConfig } from 'astro/config'
import vercel from '@astrojs/vercel/serverless'
import fs from 'fs/promises'
import path from 'path'

if (!process.env.VERCEL) {
  const packagesPath = path.join(process.cwd(), '..', 'packages')
  const packages = await fs.readdir(path.join(process.cwd(), '..', 'packages'))

  for (const packageName of packages) {
    const readmePath = path.join(packagesPath, packageName, 'README.md')
    const packageJSONPath = path.join(packagesPath, packageName, 'package.json')
    const pagePath = path.join(
      process.cwd(),
      'src',
      'pages',
      'packages',
      `${packageName}.md`,
    )
    let content = await fs.readFile(readmePath, 'utf8')
    const packageJSON = JSON.parse(await fs.readFile(packageJSONPath, 'utf8'))

    if (!content.trim()) {
      content = await fs.readFile(
        path.join(packagesPath, packageName, 'src', 'index.test.ts'),
        'utf8',
      )

      content =
        `
There is no docs yet, but you could check tests instead:
` +
        '```ts\n' +
        content +
        '\n```\n'
    }

    await fs.writeFile(
      pagePath,
      `---
layout: ../../layouts/Layout.astro
title: ${packageName}
description: ${packageJSON.description}
---  
` + content,
    )
  }
}

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
})
