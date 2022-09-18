import { defineConfig } from 'astro/config'
import vercel from '@astrojs/vercel/serverless'
import fs from 'fs/promises'
import path from 'path'

console.log(process.env)

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
  const content = await fs.readFile(readmePath, 'utf8')
  const packageJSON = JSON.parse(await fs.readFile(packageJSONPath, 'utf8'))

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

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
})
