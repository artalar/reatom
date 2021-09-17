import fs from 'fs'
import { promises as fsp } from 'fs'
import * as path from 'path'

export const ROOT_PATH = path.resolve(__dirname, '..')

export const PACKAGES_PATH = path.resolve(ROOT_PATH, 'packages')

export const PACKAGES = fs
  .readdirSync(PACKAGES_PATH)
  .filter((packageName) => !packageName.startsWith('.'))

export const PACKAGES_PATHS = PACKAGES.map((packageName) =>
  path.resolve(PACKAGES_PATH, packageName),
)

const invalid = Symbol()
export function cached<T extends (...a: any[]) => any>(
  fn: T,
): T & { invalidate: T } {
  let cache = invalid

  const invalidate = (...a: any[]) => (cache = fn(...a))

  return Object.assign(
    (...a: any[]) => (cache === invalid ? invalidate(...a) : cache),
    { invalidate },
  ) as any
}
