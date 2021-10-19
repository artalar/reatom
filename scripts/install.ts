import { $ } from 'zx'

import { cached, PACKAGES_PATHS, ROOT_PATH } from './common'

export const install = cached(async function install() {
  console.log('install')
  console.time('install')

  await $`cd ${ROOT_PATH} && npm i`
  for (const path of PACKAGES_PATHS) {
    await $`cd ${path} && npm i`
  }


  console.timeEnd('install')
})
