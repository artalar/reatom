import { $ } from 'zx'

import { cached, PACKAGES_PATHS } from './common'
import { install } from './install'

export const test = cached(async function test() {
  await install()

  console.log('test')
  console.time('test')

  await Promise.all(
    PACKAGES_PATHS.map((packagePath) => $`cd ${packagePath} && npm run test`),
  )

  console.timeEnd('test')
})
