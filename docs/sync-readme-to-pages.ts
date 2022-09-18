import fs from 'fs/promises'
import path from 'path'

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

  content =
    `---
layout: ../../layouts/Layout.astro
title: ${packageName}
description: ${packageJSON.description}
---  
` + content

  if (content !== (await fs.readFile(pagePath, 'utf8'))) {
    console.log(`"${packageName}" docs updated`)
    await fs.writeFile(pagePath, content)
  }
}
