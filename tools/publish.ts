import 'zx/globals'
import path from 'path'
import fs from 'fs/promises'

main()
async function main() {
  const packages = await fs.readdir(path.join(process.cwd(), 'packages'))

  $.log = () => {}

  for (const packageName of packages) {
    const packagePath = path.join(process.cwd(), 'packages', packageName)
    const packageJSONPath = path.join(packagePath, 'package.json')

    const packageJSON = JSON.parse(await fs.readFile(packageJSONPath, 'utf8'))

    try {
      var npmVersion = (
        await $`npm view @reatom/${packageName}@alpha version`
      ).stdout.trim()
    } catch (error) {
      console.warn(`"${packageName}" is not published yet`)
      continue
    }

    if (packageJSON.version !== npmVersion) {
      await $`cd ${packagePath} && npm publish`
    }
  }
}
