import fs from 'fs/promises'
import path from 'path'

const root = path.join(process.cwd(), '..')
const packagesPath = path.join(root, 'packages')
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

  if (packageJSON.private) continue

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
  } else {
    content = content.replaceAll('https://www.reatom.dev', '')
  }

  content =
    `---
layout: ../../layouts/Layout.astro
title: ${packageName}
description: ${packageJSON.description}
---  
` + content

  // try {
  //   if (content !== (await fs.readFile(pagePath, 'utf8'))) {
  //     console.log(`"${packageName}" docs updated`)
  //     await fs.writeFile(pagePath, content)
  //   }
  // } catch (error) {
  //   const message = (error as any)?.message
  //   if (
  //     typeof message !== 'string' ||
  //     !message.includes('no such file or directory')
  //   ) {
  //     throw error
  //   }
  // }

  await fs.writeFile(pagePath, content)
}

const rootReadmePath = path.join(root, 'README.md')
const rootPagePath = path.join(root, 'docs', 'src', 'pages', 'index.md')
let readme = await fs.readFile(rootReadmePath, 'utf8')
readme =
  `---
layout: ../layouts/Layout.astro
title: Main
description: Reatom - tiny and powerful reactive system with immutable nature
---

` + readme.replaceAll('https://www.reatom.dev', '')

await fs.writeFile(rootPagePath, readme)
