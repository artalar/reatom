import * as path from 'path'
import { npmPublish } from '@jsdevtools/npm-publish'
import * as github from '@actions/github'

import { PACKAGES_PATHS } from './common'
import { install } from './install'
import { test } from './test'

export async function publish() {
  const login = github.context.payload.pull_request?.user?.login

  if (!login) {
    throw new Error('The PR author login is missed')
  }

  const tag = `preview_${login}_${Date.now()}`

  await install()
  await test()

  console.log('publish')
  console.time('publish')

  const packages = PACKAGES_PATHS.map((packagesPath) =>
    path.resolve(packagesPath, 'package.json'),
  )

  const result = await Promise.all(
    packages.map((packagePath) =>
      npmPublish({
        access: 'public',
        package: packagePath,
        tag,
        token: process.env.NPM_TOKEN,

        // FIXME after tests
        dryRun: true,
        debug: console.debug,
      }),
    ),
  )

  console.timeEnd('publish')
}
