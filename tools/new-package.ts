import 'zx/globals'
import path from 'path'
import fs from 'fs/promises'
import { createInterface } from 'readline'

const templateLocation = 'tools/new-package-template'

async function personalizeTemplate(dirPath: string, name: string) {
  const files = await fs.readdir(dirPath)

  for (const file of files) {
    const filePath = path.join(dirPath, file)

    if ((await fs.stat(filePath)).isFile()) {
      const templateContent = await fs.readFile(filePath, 'utf8')
      const newContent = templateContent.replaceAll('<%= name %>', name)

      if (templateContent !== newContent) {
        await fs.writeFile(filePath, newContent)
      }
    } else {
      await personalizeTemplate(filePath, name)
    }
  }
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
})

rl.question("What's a new package name? ", async (name) => {
  console.log('name is', name)

  const newPackageLocation = path.join(process.cwd(), 'packages', name)

  // TODO: https://nodejs.org/api/fs.html#fspromisescpsrc-dest-options
  await $`cp -r ${templateLocation} ${newPackageLocation}`

  await personalizeTemplate(newPackageLocation, name)

  console.log(`Done! You could go to ${newPackageLocation}`)

  process.exit()
})
