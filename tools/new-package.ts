import 'zx/globals'
import path from 'path'
import fs from 'fs/promises'
import { createInterface } from 'readline'

const templateLocation = 'tools/new-package-template'

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
})

async function personalizeTemplate(packagePath: string, name: string) {
  const files = await fs.readdir(packagePath)

  for (const file of files) {
    const filePath = path.join(packagePath, file)

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

rl.question("What's a new package name? ", async (name) => {
  console.log('name is', name)

  const newPackageLocation = path.join(process.cwd(), 'packages', name)

  // FIXME: https://nodejs.org/api/fs.html#fspromisescpsrc-dest-options
  await $`cp -r ${templateLocation} ${newPackageLocation}`

  await personalizeTemplate(newPackageLocation, name)

  console.log(`Done! You could go to ${newPackageLocation}`)

  process.exit()
})
