import * as path from 'path'
import { npmPublish } from '@jsdevtools/npm-publish'

import { PACKAGES_PATHS } from './common'
import { install } from './install'
import { test } from './test'

export async function publish() {
  await install()
  await test()

  const packages = PACKAGES_PATHS.map((packagesPath) =>
    path.resolve(packagesPath, 'package.json'),
  )

  const result = await Promise.all(
    packages.map((packagePath) =>
      npmPublish({
        package: packagePath,
        token: process.env.NPM_TOKEN
        // token: 'f1235d6c-e8e7-4761-bbba-b9106bb3966d',
      }),
    ),
  )

  console.log(result)
}
