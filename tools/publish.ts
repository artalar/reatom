import 'zx/globals'
import prettier from 'prettier'
import path from 'path'
import fs from 'fs/promises'
import { createInterface } from 'readline'

const updateFramework = async () => {
  const packageJson: { version: string; dependencies: Record<string, string> } =
    JSON.parse(
      await fs.readFile(
        path.join(process.cwd(), 'packages', 'framework', 'package.json'),
        'utf8',
      ),
    )
  const { dependencies } = packageJson
  let isChanged = false

  for (const name in dependencies) {
    const { version }: { version: string } = JSON.parse(
      await fs.readFile(
        path.join(
          process.cwd(),
          'packages',
          name.replace('@reatom/', ''),
          'package.json',
        ),
        'utf8',
      ),
    )

    isChanged ||= dependencies[name] !== version

    dependencies[name] = version
  }

  if (!isChanged) return

  const [major, minor, patch] = packageJson.version.split('.')
  packageJson.version = [major, minor, Number(patch) + 1].join('.')

  const prettierConfig = await prettier.resolveConfig(
    path.join(process.cwd(), '.prettierrc'),
  )
  await fs.writeFile(
    path.join(process.cwd(), 'packages', 'framework', 'package.json'),
    prettier.format(JSON.stringify(packageJson), {
      ...prettierConfig,
      parser: 'json',
    }),
    'utf8',
  )
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
})

let otpCache: string

const main = async () => {
  await updateFramework()

  const packages = await fs.readdir(path.join(process.cwd(), 'packages'))

  $.log = () => {}

  for (const packageName of packages) {
    const packagePath = path.join(process.cwd(), 'packages', packageName)
    const packageJSONPath = path.join(packagePath, 'package.json')

    const packageJSON = JSON.parse(await fs.readFile(packageJSONPath, 'utf8'))

    if (packageJSON.private) continue

    let npmVersion = '-1'
    try {
      npmVersion = (
        await $`npm view @reatom/${packageName} version`
      ).stdout.trim()
    } catch (error) {
      console.warn(`"${packageName}" is not published yet`)

      let answer = await new Promise((r) =>
        rl.question('continue?(y/n = y)', r),
      )
      answer ||= 'y'
      if (answer !== 'y') continue
    }

    if (packageJSON.version !== npmVersion) {
      // warm up cache
      await $`npx turbo run test --filter=${packageName}`

      const otp = (otpCache = await new Promise((r) => {
        let message = `Enter OTP code for "${packageName}@${packageJSON.version}"`
        if (otpCache) message += ` (${otpCache})`
        rl.question(`${message}: `, (otp) => r(otp || otpCache))
      }))

      if (!otp) throw new Error('OTP code missed')

      await $`cd ${packagePath} && npm publish --otp=${otp} --access public`
    }
  }

  process.exit()
}

main()
